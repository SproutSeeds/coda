import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { IncomingMessage } from "node:http";

export type RunnerStatus = "initializing" | "pairing" | "online" | "stopped" | "error";

export interface RunnerLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface RunnerLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface PairingCodePayload {
  code: string;
  expiresAt: Date;
}

export interface PairingSuccessPayload {
  runnerId: string;
  runnerToken: string;
  relayUrl?: string;
}

export interface RunnerEvents {
  onLog?(entry: RunnerLogEntry): void;
  onStatusChange?(status: RunnerStatus): void;
  onPairingCode?(payload: PairingCodePayload): void;
  onPairingSuccess?(payload: PairingSuccessPayload): void;
  onError?(error: Error): void;
}

export interface StoredRunnerToken {
  runnerToken: string;
  runnerId: string;
  relayUrl?: string;
}

export interface RunnerTokenStore {
  load(): Promise<StoredRunnerToken | null>;
  save(payload: StoredRunnerToken): Promise<void>;
  clear?(): Promise<void>;
}

export interface TTYOptions {
  host?: string;
  port?: number;
  cwd?: string;
  sync?: "tmux" | "disabled";
  sessionPrefix?: string;
  sessionName?: string;
}

export interface RelayOptions {
  url?: string;
  token?: string;
}

export interface RunnerOptions {
  baseUrl?: string;
  runnerId?: string;
  runnerName?: string;
  runnerToken?: string;
  env?: NodeJS.ProcessEnv;
  logger?: RunnerLogger;
  events?: RunnerEvents;
  tokenStore?: RunnerTokenStore;
  codex?: { command: string; args?: string[] };
  enableTTY?: boolean;
  tty?: TTYOptions;
  relay?: RelayOptions;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  pairingPollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  jobPollIntervalMs?: number;
}

export interface RunnerHandle {
  stop(): Promise<void>;
  status(): RunnerStatus;
}

type MutableEnv = Record<string, string | undefined>;

interface NormalizedOptions {
  baseUrl: string;
  runnerId: string;
  runnerName: string;
  runnerToken?: string;
  env: MutableEnv;
  codex: { command: string | null; args: string[] };
  enableTTY: boolean;
  tty: Required<TTYOptions>;
  relay: RelayOptions;
  logger: RunnerLogger;
  events: RunnerEvents;
  tokenStore?: RunnerTokenStore;
  fetchImpl: typeof fetch;
  pairingPollIntervalMs: number;
  heartbeatIntervalMs: number;
  jobPollIntervalMs: number;
}

interface AsyncDisposable {
  stop(): Promise<void>;
}

const defaultLogger: RunnerLogger = {
  info(message, context) {
    context ? console.log(message, context) : console.log(message);
  },
  warn(message, context) {
    context ? console.warn(message, context) : console.warn(message);
  },
  error(message, context) {
    context ? console.error(message, context) : console.error(message);
  },
};

const noopAsyncDisposable: AsyncDisposable = {
  async stop() {
    /* noop */
  },
};

export function createFileTokenStore(appName = "Coda Runner"): RunnerTokenStore {
  async function getConfigPath() {
    const os = await import("node:os");
    const path = await import("node:path");
    const home = os.homedir();
    let dir = "";
    if (process.platform === "darwin") {
      dir = path.join(home, "Library", "Application Support", appName);
    } else if (process.platform === "win32") {
      dir = path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), appName);
    } else {
      dir = path.join(home, ".config", appName.replace(/\s+/g, "-").toLowerCase());
    }
    return { dir, file: path.join(dir, "config.json") };
  }

  return {
    async load() {
      try {
        const fs = await import("node:fs/promises");
        const { file } = await getConfigPath();
        const raw = await fs.readFile(file, "utf8").catch(() => "");
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredRunnerToken;
        if (!parsed.runnerToken || !parsed.runnerId) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async save(payload) {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const { dir, file } = await getConfigPath();
        await fs.mkdir(dir, { recursive: true });
        const tmp = path.join(dir, `.config.${Date.now()}.tmp`);
        await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
        await fs.rename(tmp, file);
      } catch {
        /* ignore */
      }
    },
    async clear() {
      try {
        const fs = await import("node:fs/promises");
        const { file } = await getConfigPath();
        await fs.rm(file, { force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

function normalizeOptions(options: RunnerOptions): NormalizedOptions {
  const env: MutableEnv = { ...(process.env as MutableEnv), ...(options.env ?? {}) };
  const pathDelimiter = process.platform === "win32" ? ";" : ":";
  const pathKeys = process.platform === "win32" ? ["Path", "PATH"] : ["PATH"];
  const currentPath =
    pathKeys
      .map((key) => env[key])
      .find((value): value is string => typeof value === "string" && value.length > 0) ||
    process.env.PATH ||
    "";
  const candidatePaths: string[] = [];
  if (process.platform === "darwin") {
    candidatePaths.push("/opt/homebrew/bin", "/opt/homebrew/sbin");
  }
  if (process.platform !== "win32") {
    candidatePaths.push("/usr/local/bin", "/usr/local/sbin");
  }
  const existingSegments = currentPath.split(pathDelimiter).filter(Boolean);
  const normalizedSegments = [
    ...candidatePaths.filter((candidate) => existsSync(candidate) && !existingSegments.includes(candidate)),
    ...existingSegments,
  ];
  const normalizedPath = normalizedSegments.join(pathDelimiter);
  if (normalizedPath.length > 0) {
    for (const key of pathKeys) {
      env[key] = normalizedPath;
    }
  }
  const baseUrl = options.baseUrl || env.BASE_URL || "http://localhost:3000";
  const runnerId = options.runnerId || env.DEV_RUNNER_ID || "";
  if (!runnerId) {
    throw new Error("runnerId is required (provide options.runnerId or DEV_RUNNER_ID)");
  }
  const runnerName = options.runnerName || env.DEV_RUNNER_NAME || runnerId || "Runner";
  const codexCommand = options.codex?.command || env.CODEX_CMD || null;
  const codexArgs = options.codex?.args ?? (env.CODEX_ARGS ? env.CODEX_ARGS.split(" ").filter(Boolean) : []);
  const enableTTY = options.enableTTY ?? true;
  const relay: RelayOptions = {
    url: options.relay?.url ?? env.RELAY_URL,
    token: options.relay?.token ?? env.RUNNER_TOKEN ?? options.runnerToken,
  };
  const logger = options.logger ?? defaultLogger;
  const events = options.events ?? {};
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("fetch implementation required (Node 18+)");
  }
  const pairingPollIntervalMs = options.pairingPollIntervalMs ?? 3000;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 20000;
  const jobPollIntervalMs = options.jobPollIntervalMs ?? 1500;
  const ttyDefaults: Required<TTYOptions> = {
    host: options.tty?.host ?? env.TTY_BIND ?? "127.0.0.1",
    port: options.tty?.port ?? Number(env.TTY_PORT ?? 8787),
    cwd: options.tty?.cwd ?? env.TTY_CWD ?? process.cwd(),
    sync:
      (options.tty?.sync ?? (String(env.TTY_SYNC || "").toLowerCase() === "tmux" ? "tmux" : "disabled")) as
        | "tmux"
        | "disabled",
    sessionPrefix: options.tty?.sessionPrefix ?? env.TTY_SESSION_PREFIX ?? "coda",
    sessionName: options.tty?.sessionName ?? env.TTY_SESSION_NAME ?? "",
  };
  return {
    baseUrl,
    runnerId,
    runnerName,
    runnerToken: options.runnerToken || env.RUNNER_TOKEN,
    env,
    codex: { command: codexCommand, args: codexArgs },
    enableTTY,
    tty: ttyDefaults,
    relay,
    logger,
    events,
    tokenStore: options.tokenStore,
    fetchImpl,
    pairingPollIntervalMs,
    heartbeatIntervalMs,
    jobPollIntervalMs,
  };
}

async function chooseFolder(): Promise<string | null> {
  return new Promise((resolve) => {
    const done = (value: string | null) => resolve(value && value.trim() ? value.trim() : null);
    try {
      const plat = process.platform;
      if (plat === "darwin") {
        const child = spawn("osascript", ["-e", 'POSIX path of (choose folder with prompt "Select project root")']);
        let out = "";
        child.stdout.on("data", (buf) => (out += String(buf)));
        child.on("close", () => done(out));
        child.on("error", () => done(null));
        return;
      }
      if (plat === "win32") {
        const script = `$f = (New-Object -ComObject Shell.Application).BrowseForFolder(0, 'Select project root', 0).Self; if ($f) { Write-Output $f.Path }`;
        const child = spawn("powershell", ["-NoProfile", "-Command", script]);
        let out = "";
        child.stdout.on("data", (buf) => (out += String(buf)));
        child.on("close", () => done(out));
        child.on("error", () => done(null));
        return;
      }
      const child = spawn("zenity", ["--file-selection", "--directory", "--title=Select project root"]);
      let out = "";
      child.stdout.on("data", (buf) => (out += String(buf)));
      child.on("close", () => done(out));
      child.on("error", () => done(null));
    } catch {
      done(null);
    }
  });
}

const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, "").replace(/[\r\t]+/g, "");

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function waitFor(signal: AbortSignal, ms: number): Promise<boolean> {
  if (signal.aborted) return false;
  try {
    await sleep(ms, undefined, { signal });
    return true;
  } catch (err) {
    if (isAbortError(err)) return false;
    throw err;
  }
}

async function startTTYServer(ctx: RunnerCore, signal: AbortSignal): Promise<AsyncDisposable> {
  if (!ctx.options.enableTTY) return noopAsyncDisposable;
  try {
    const ws = (await import("ws")) as any;
    const pty = (await import("node-pty")) as typeof import("node-pty");
    const host = ctx.options.tty.host;
    const port = ctx.options.tty.port;
    const { WebSocketServer } = ws;
    const server = new WebSocketServer({ host, port });
    const sockets = new Set<any>();
    const activeTerminals = new Map<any, { term: any; socket: any }>();
    ctx.log("info", `TTY server listening ws://${host}:${port}/tty`);
    server.on("connection", async (socket: any, req: IncomingMessage) => {
      sockets.add(socket);
      const destroy = () => {
        sockets.delete(socket);
        activeTerminals.delete(socket);
        try {
          socket.close();
        } catch {
          /* noop */
        }
      };
      try {
        const url = new URL(req.url || "/tty", `http://${req.headers.host || "localhost"}`);
        if (url.pathname !== "/tty") {
          socket.close(1008, "invalid path");
          return;
        }

        // Single-connection limit: close existing connections before accepting new one
        if (activeTerminals.size > 0) {
          ctx.log("info", "[TTY] Closing existing connections to enforce single-connection limit", {
            existingConnections: activeTerminals.size,
          });
          for (const [existingSocket, { term }] of Array.from(activeTerminals.entries())) {
            try {
              term.kill();
            } catch {
              /* noop */
            }
            try {
              existingSocket.close();
            } catch {
              /* noop */
            }
            activeTerminals.delete(existingSocket);
            sockets.delete(existingSocket);
          }
        }

        ctx.log("info", "TTY client connected", { remote: (req.socket as any)?.remoteAddress });
        const shell =
          process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");
        const cols = Number(url.searchParams.get("cols") || 80);
        const rows = Number(url.searchParams.get("rows") || 24);
        let cwd = ctx.options.tty.cwd;
        const qpCwd = url.searchParams.get("cwd");
        if (qpCwd && qpCwd.trim() !== "") {
          cwd = qpCwd;
        }
        const useTmux = ctx.options.tty.sync === "tmux";
        let cmd = shell;
        let args: string[] = [];
        if (useTmux) {
          const staticName = ctx.options.tty.sessionName?.trim();
          const sessionName = staticName && staticName.length > 0
            ? staticName
            : `${ctx.options.tty.sessionPrefix}-${Math.random().toString(36).slice(2, 8)}`;

          // First, ensure the tmux session exists by creating it detached if needed
          const { execSync } = await import("child_process");
          // Ensure tmux is in PATH (common locations for Homebrew, MacPorts, Linux)
          const extendedPath = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            process.env.PATH || ""
          ].filter(Boolean).join(":");
          const execOptions = { env: { ...process.env, PATH: extendedPath } };

          try {
            execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, execOptions);
            ctx.log("info", `TTY tmux session ${sessionName} exists, attaching`);
          } catch {
            // Session doesn't exist, create it detached
            execSync(`tmux new-session -d -s ${sessionName} -c ${cwd}`, execOptions);
            ctx.log("info", `TTY tmux session ${sessionName} created detached`);
          }

          cmd = "tmux";
          args = ["attach-session", "-t", sessionName];
          try {
            if ((socket as any).readyState === 1) socket.send(`coda:session:${sessionName}\n`);
          } catch {
            /* noop */
          }
        }
        // Ensure tmux is in PATH for pty.spawn as well
        const extendedPath = [
          "/opt/homebrew/bin",
          "/usr/local/bin",
          "/usr/bin",
          "/bin",
          ctx.options.env.PATH || process.env.PATH || ""
        ].filter(Boolean).join(":");
        const spawnEnv = { ...ctx.options.env, PATH: extendedPath };

        const term = pty.spawn(cmd, args, {
          name: "xterm-color",
          cols,
          rows,
          cwd,
          env: spawnEnv as any,
        });
        activeTerminals.set(socket, { term, socket });
        let recording: { jobId: string; token: string; buffer: string; pendingLines: Array<{ level: string; line: string }> } | null = null;
        let flushTimer: NodeJS.Timeout | null = null;

        // Throttled log flushing - batch logs and send every 500ms max
        const flushLogs = async () => {
          if (!recording || recording.pendingLines.length === 0) return;
          const linesToSend = recording.pendingLines.splice(0, recording.pendingLines.length);
          try {
            await ctx.fetchJson(
              `${ctx.options.baseUrl}/api/devmode/logs/ingest?jobId=${encodeURIComponent(recording.jobId)}&token=${encodeURIComponent(recording.token)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lines: linesToSend }),
              },
              false,
            );
          } catch {
            /* ignore */
          }
        };

        term.onData(async (data: string) => {
          if ((socket as any).readyState === 1) {
            socket.send(data);
          }
          if (recording) {
            try {
              recording.buffer += data;
              const parts = recording.buffer.replaceAll("\r\n", "\n").split("\n");
              recording.buffer = parts.pop() ?? "";
              const lines = parts
                .map((line) => stripAnsi(line))
                .map((line) => line.trimEnd())
                .filter((line) => line.length > 0)
                .map((line) => ({ level: "info", line }));

              if (lines.length) {
                recording.pendingLines.push(...lines);

                // Flush immediately if buffer is large (>100 lines) to prevent memory buildup
                if (recording.pendingLines.length > 100) {
                  if (flushTimer) {
                    clearTimeout(flushTimer);
                    flushTimer = null;
                  }
                  await flushLogs();
                } else {
                  // Otherwise, debounce the flush to batch multiple lines together
                  if (flushTimer) clearTimeout(flushTimer);
                  flushTimer = setTimeout(() => {
                    flushLogs().catch(() => {});
                    flushTimer = null;
                  }, 500);
                }
              }
            } catch {
              /* ignore */
            }
          }
        });
        socket.on("message", async (msg: Buffer) => {
          try {
            const decoded = msg.toString();
            if (decoded && decoded.startsWith("{")) {
              const obj = JSON.parse(decoded);
              if (obj?.type === "resize" && obj.cols && obj.rows) {
                term.resize(Number(obj.cols), Number(obj.rows));
                return;
              }
              if (obj?.type === "record" && obj.jobId && obj.token) {
                recording = { jobId: String(obj.jobId), token: String(obj.token), buffer: "", pendingLines: [] };
                ctx.log("info", `TTY recording enabled for job ${recording.jobId}`);
                return;
              }
              if (obj?.type === "record-stop") {
                const jobId = recording?.jobId;
                recording = null;
                if (jobId) {
                  try {
                    await ctx.fetchJson(
                      `${ctx.options.baseUrl}/api/devmode/jobs/${encodeURIComponent(jobId)}/finish`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ state: "succeeded" }),
                      },
                      false,
                    );
                  } catch {
                    /* ignore */
                  }
                }
                return;
              }
              if (obj?.type === "pick-cwd") {
                try {
                  const path = await chooseFolder();
                  if ((socket as any).readyState === 1) {
                    socket.send(path ? `coda:cwd:${path}\n` : `coda:error:No folder selected\n`);
                  }
                } catch (e) {
                  const msgText = (e as Error).message || String(e);
                  if ((socket as any).readyState === 1) {
                    socket.send(`coda:error:${msgText}\n`);
                  }
                }
                return;
              }
            }
          } catch {
            /* ignore */
          }
          term.write(msg.toString());
        });
        const cleanup = async () => {
          try {
            term.kill();
          } catch {
            /* noop */
          }
          if (recording?.jobId) {
            const id = recording.jobId;
            recording = null;
            try {
              await ctx.fetchJson(
                `${ctx.options.baseUrl}/api/devmode/jobs/${encodeURIComponent(id)}/finish`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ state: "succeeded" }),
                },
                false,
              );
            } catch {
              /* ignore */
            }
          }
        };
        socket.on("close", cleanup);
        socket.on("error", cleanup);
        signal.addEventListener(
          "abort",
          () => {
            cleanup().catch(() => {});
            destroy();
          },
          { once: true },
        );
      } catch (err) {
        ctx.log("warn", "TTY connection error", { message: (err as Error).message });
        destroy();
      }
    });

    const stop = async () => {
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {
          /* noop */
        }
      }
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    };

    signal.addEventListener(
      "abort",
      () => {
        stop().catch(() => {});
      },
      { once: true },
    );

    return { stop };
  } catch (err) {
    ctx.log("warn", "TTY server disabled", { error: (err as Error).message });
    return noopAsyncDisposable;
  }
}

async function startRelayClient(ctx: RunnerCore, signal: AbortSignal, relay: RelayOptions): Promise<AsyncDisposable> {
  if (!relay.url || !relay.token) {
    return noopAsyncDisposable;
  }
  try {
    const wsMod = (await import("ws")) as any;
    const pty = (await import("node-pty")) as typeof import("node-pty");
    type Session = {
      term: import("node-pty").IPty;
      recording?: { jobId: string; token: string; buffer: string; pendingLines: Array<{ level: string; line: string }> } | null;
      flushTimer?: NodeJS.Timeout | null;
    };
    const sessions = new Map<string, Session>();
    let closed = false;
    const aborters = new Set<() => void>();

    const connect = () => {
      if (signal.aborted || closed) return;
      const endpoint = new URL(relay.url!);
      endpoint.pathname = "/runner";
      endpoint.searchParams.set("token", relay.token!);
      const sock = new wsMod.WebSocket(endpoint.toString());
      const cleanupSession = async (sid: string) => {
        const sess = sessions.get(sid);
        if (!sess) return;
        sessions.delete(sid);
        try {
          sess.term.kill();
        } catch {
          /* noop */
        }
      };
      const send = (obj: unknown) => {
        try {
          if (sock.readyState === 1) {
            sock.send(JSON.stringify(obj));
          }
        } catch {
          /* noop */
        }
      };

      const onClose = (code?: number, reason?: Buffer) => {
        if (closed || signal.aborted) return;
        const reasonText =
          reason && reason.byteLength > 0 ? reason.toString("utf8") : undefined;
        ctx.log("warn", "Relay disconnected; retrying in 2s", {
          code,
          reason: reasonText,
        });
        waitFor(signal, 2000).then((ok) => {
          if (ok) connect();
        });
      };

      sock.on("open", () => {
        ctx.log("info", "Relay connected");
      });

      sock.on("close", onClose);
      sock.on("error", (error: Error) => {
        ctx.log("warn", "Relay error", { message: error.message });
      });
      sock.on("unexpected-response", (_req: any, res: any) => {
        ctx.log("warn", "Relay unexpected response", {
          statusCode: res?.statusCode,
          statusMessage: res?.statusMessage,
        });
      });

      sock.on("message", async (raw: any) => {
        let msg: any;
        try {
          msg = JSON.parse(String(raw));
          ctx.log("info", "[relay] Received message", { type: msg?.type, sessionId: msg?.sessionId });
        } catch {
          return;
        }
        const sessionId = String(msg.sessionId ?? "");
        if (!sessionId) return;
        if (msg.type === "session-open") {
          // If no cwd/projectRoot is set, this is likely a picker session - don't spawn terminal yet
          const hasCwd = (typeof msg.cwd === "string" && msg.cwd.trim() !== "") ||
                        (ctx.options.tty.cwd && ctx.options.tty.cwd !== "/" && ctx.options.tty.cwd.trim() !== "");
          if (!hasCwd) {
            ctx.log("info", "[relay] Picker session detected, waiting for pick-cwd message", { sessionId });
            // Create a placeholder session without a terminal
            sessions.set(sessionId, { term: null as any, recording: null });
            return;
          }

          // Single-connection limit: close any existing terminal sessions before creating a new one
          const existingTerminalSessions = Array.from(sessions.entries()).filter(([_, sess]) => sess.term);
          if (existingTerminalSessions.length > 0) {
            ctx.log("info", "[relay] Closing existing sessions to enforce single-connection limit", {
              existingSessions: existingTerminalSessions.map(([sid]) => sid),
              newSessionId: sessionId
            });
            for (const [sid] of existingTerminalSessions) {
              await cleanupSession(sid);
            }
          }

          try {
            const shell =
              process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");
            const cols = Number(msg.cols || 80);
            const rows = Number(msg.rows || 24);
            let cwd = ctx.options.tty.cwd;
            if (typeof msg.cwd === "string" && msg.cwd.trim() !== "") {
              cwd = msg.cwd;
            }
            // Fallback to home directory if cwd is not set or is root
            if (!cwd || cwd === "/" || cwd.trim() === "") {
              cwd = process.env.HOME || process.env.USERPROFILE || process.cwd();
            }
            const useTmux = ctx.options.tty.sync === "tmux";
            let cmd = shell;
            let args: string[] = [];
            let sessionName: string | null = null;
            if (useTmux) {
              const staticName = ctx.options.tty.sessionName?.trim();
              sessionName = staticName && staticName.length > 0
                ? staticName
                : `${ctx.options.tty.sessionPrefix}-${Math.random().toString(36).slice(2, 8)}`;

              // First, ensure the tmux session exists by creating it detached if needed
              const { execSync } = await import("child_process");
              // Ensure tmux is in PATH (common locations for Homebrew, MacPorts, Linux)
              const extendedPath = [
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                process.env.PATH || ""
              ].filter(Boolean).join(":");
              const execOptions = { env: { ...process.env, PATH: extendedPath } };

              try {
                execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, execOptions);
                ctx.log("info", `Relay tmux session ${sessionName} exists, attaching`);
              } catch {
                // Session doesn't exist, create it detached
                execSync(`tmux new-session -d -s ${sessionName} -c ${cwd}`, execOptions);
                ctx.log("info", `Relay tmux session ${sessionName} created detached`);
              }

              cmd = "tmux";
              args = ["attach-session", "-t", sessionName];
            }
            // Ensure tmux is in PATH for pty.spawn as well
            const extendedPath = [
              "/opt/homebrew/bin",
              "/usr/local/bin",
              "/usr/bin",
              "/bin",
              ctx.options.env.PATH || process.env.PATH || ""
            ].filter(Boolean).join(":");
            const spawnEnv = { ...ctx.options.env, PATH: extendedPath };

            ctx.log("info", "[relay] Spawning terminal", { cmd, args, cwd });
            const term = pty.spawn(cmd, args, {
              name: "xterm-color",
              cols,
              rows,
              cwd,
              env: spawnEnv as any,
            });
            const sess: Session = { term, recording: null };
            sessions.set(sessionId, sess);
            ctx.log("info", "[relay] Session created", { sessionId, pid: term.pid });
            if (sessionName) {
              send({ type: "meta", sessionId, data: `coda:session:${sessionName}` });
            }

            // Throttled log flushing for relay sessions
            const flushRelayLogs = async () => {
              if (!sess.recording || sess.recording.pendingLines.length === 0) return;
              const linesToSend = sess.recording.pendingLines.splice(0, sess.recording.pendingLines.length);
              try {
                await ctx.fetchJson(
                  `${ctx.options.baseUrl}/api/devmode/logs/ingest?jobId=${encodeURIComponent(sess.recording.jobId)}&token=${encodeURIComponent(sess.recording.token)}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lines: linesToSend }),
                  },
                  false,
                );
              } catch {
                /* ignore */
              }
            };

            term.onData(async (data) => {
              send({ type: "stdout", sessionId, data });
              if (sess.recording) {
                try {
                  sess.recording.buffer += data;
                  const parts = sess.recording.buffer.replaceAll("\r\n", "\n").split("\n");
                  sess.recording.buffer = parts.pop() ?? "";
                  const lines = parts
                    .map((line) => stripAnsi(line))
                    .map((line) => line.trimEnd())
                    .filter((line) => line.length > 0)
                    .map((line) => ({ level: "info", line }));

                  if (lines.length) {
                    sess.recording.pendingLines.push(...lines);

                    // Flush immediately if buffer is large (>100 lines)
                    if (sess.recording.pendingLines.length > 100) {
                      if (sess.flushTimer) {
                        clearTimeout(sess.flushTimer);
                        sess.flushTimer = null;
                      }
                      await flushRelayLogs();
                    } else {
                      // Otherwise, debounce the flush to batch multiple lines together
                      if (sess.flushTimer) clearTimeout(sess.flushTimer);
                      sess.flushTimer = setTimeout(() => {
                        flushRelayLogs().catch(() => {});
                        sess.flushTimer = null;
                      }, 500);
                    }
                  }
                } catch {
                  /* ignore */
                }
              }
            });
            term.onExit(async (exitCode) => {
              ctx.log("info", "[relay] Terminal exited", { sessionId, exitCode });
              await cleanupSession(sessionId);
            });
          } catch (error) {
            ctx.log("warn", "Relay session-open failed", { message: (error as Error).message });
          }
          return;
        }
        const sess = sessions.get(sessionId);
        if (!sess) {
          ctx.log("warn", "[relay] Session not found", { sessionId, availableSessions: Array.from(sessions.keys()) });
          return;
        }
        if (msg.type === "stdin" && typeof msg.data === "string") {
          if (!sess.term) return; // Ignore stdin for picker sessions
          try {
            sess.term.write(msg.data);
          } catch {
            /* noop */
          }
          return;
        }
        if (msg.type === "resize" && msg.cols && msg.rows) {
          if (!sess.term) return; // Ignore resize for picker sessions
          try {
            sess.term.resize(Number(msg.cols), Number(msg.rows));
          } catch {
            /* noop */
          }
          return;
        }
        if (msg.type === "record" && msg.jobId && msg.token) {
          sess.recording = { jobId: String(msg.jobId), token: String(msg.token), buffer: "", pendingLines: [] };
          sess.flushTimer = null;
          return;
        }
        if (msg.type === "pick-cwd") {
          try {
            ctx.log("info", "[relay] Handling pick-cwd", { sessionId, hasSession: sessions.has(sessionId) });
            const path = await chooseFolder();
            const data = path ? `coda:cwd:${path}\n` : `coda:error:No folder selected\n`;
            send({ type: "meta", sessionId, data });
            // Clean up picker placeholder session if it exists
            if (sess && !sess.term) {
              ctx.log("info", "[relay] Cleaning up picker session", { sessionId });
              sessions.delete(sessionId);
            }
          } catch (error) {
            send({
              type: "meta",
              sessionId,
              data: `coda:error:${(error as Error).message}\n`,
            });
            // Clean up picker placeholder session on error too
            if (sess && !sess.term) {
              sessions.delete(sessionId);
            }
          }
          return;
        }
      });

      const abort = () => {
        try {
          sock.terminate();
        } catch {
          /* noop */
        }
      };
      aborters.add(abort);
    };

    connect();

    const stop = async () => {
      closed = true;
      for (const abort of aborters) {
        abort();
      }
      aborters.clear();
      for (const [sid, session] of sessions) {
        sessions.delete(sid);
        try {
          session.term.kill();
        } catch {
          /* noop */
        }
      }
    };

    signal.addEventListener(
      "abort",
      () => {
        stop().catch(() => {});
      },
      { once: true },
    );

    return { stop };
  } catch (err) {
    ctx.log("warn", "Relay client disabled", { error: (err as Error).message });
    return noopAsyncDisposable;
  }
}

class RunnerCore implements RunnerHandle {
  readonly options: NormalizedOptions;
  private readonly controller: AbortController;
  private readonly externalSignal?: AbortSignal;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private runnerLoopPromise: Promise<void> | null = null;
  private statusValue: RunnerStatus = "initializing";
  private stopped = false;
  private ttyHandle: AsyncDisposable = noopAsyncDisposable;
  private relayHandle: AsyncDisposable = noopAsyncDisposable;
  private runnerToken: string | undefined;
  private runnerId: string;
  private relayUrl?: string;

  constructor(options: RunnerOptions) {
    this.options = normalizeOptions(options);
    this.runnerId = this.options.runnerId;
    this.controller = new AbortController();
    this.externalSignal = options.signal;
    if (this.externalSignal) {
      if (this.externalSignal.aborted) {
        this.controller.abort();
      } else {
        this.externalSignal.addEventListener("abort", () => this.controller.abort());
      }
    }
    if (this.options.runnerToken) {
      this.runnerToken = this.options.runnerToken;
    }
    if (this.options.relay.url) {
      this.relayUrl = this.options.relay.url;
    }
  }

  status(): RunnerStatus {
    return this.statusValue;
  }

  private get signal(): AbortSignal {
    return this.controller.signal;
  }

  private get logger(): RunnerLogger {
    return this.options.logger;
  }

  private get events(): RunnerEvents {
    return this.options.events;
  }

  private setStatus(status: RunnerStatus) {
    if (this.statusValue === status) return;
    this.statusValue = status;
    this.events.onStatusChange?.(status);
  }

  log(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
    const entry: RunnerLogEntry = { level, message, context };
    const logger = this.logger;
    logger[level](message, context);
    this.events.onLog?.(entry);
  }

  async start(): Promise<void> {
    if (this.stopped) {
      throw new Error("Runner has already been stopped");
    }
    this.setStatus("initializing");
    this.ttyHandle = await startTTYServer(this, this.signal);
    await this.ensureRunnerToken();
    await this.startRelayIfNeeded();
    await this.registerRunner();
    this.startHeartbeatLoop();
    this.setStatus("online");
    this.runnerLoopPromise = this.runnerLoop().catch((err) => {
      if (this.signal.aborted) return;
      this.setStatus("error");
      this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.log("error", "Runner loop failed", { error: (err as Error)?.message ?? String(err) });
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.controller.abort();
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      await this.ttyHandle.stop();
    } catch {
      /* noop */
    }
    try {
      await this.relayHandle.stop();
    } catch {
      /* noop */
    }
    if (this.runnerLoopPromise) {
      try {
        await this.runnerLoopPromise;
      } catch {
        /* ignore */
      }
    }
    this.setStatus("stopped");
  }

  private async ensureRunnerToken(): Promise<void> {
    if (this.runnerToken) return;
    const envToken = this.options.env.RUNNER_TOKEN;
    if (envToken) {
      this.runnerToken = envToken;
      return;
    }
    const storeToken = await this.options.tokenStore?.load();
    if (storeToken?.runnerToken && storeToken.runnerId) {
      this.runnerToken = storeToken.runnerToken;
      this.runnerId = storeToken.runnerId;
      if (storeToken.relayUrl) this.relayUrl = storeToken.relayUrl;
      this.options.env.RUNNER_TOKEN = storeToken.runnerToken;
      return;
    }
    this.setStatus("pairing");
    const startRes = await this.fetchJson<{ code: string; expiresAt: string }>(
      `${this.options.baseUrl}/api/devmode/pair/start`,
      { method: "POST" },
    );
    const expiresAt = new Date(startRes.expiresAt);
    this.events.onPairingCode?.({ code: startRes.code, expiresAt });
    this.log("info", "Pairing code issued", { code: startRes.code, expiresAt: expiresAt.toISOString() });
    const deadline = expiresAt.getTime();
    while (!this.signal.aborted) {
      const waited = await waitFor(this.signal, this.options.pairingPollIntervalMs);
      if (!waited) break;
      if (Date.now() > deadline) {
        this.events.onError?.(new Error("Pairing expired"));
        throw new Error("Pairing expired");
      }
      try {
        const res = await this.fetchJson<{
          status?: string;
          runnerToken?: string;
          runnerId?: string;
          relayUrl?: string;
        }>(
          `${this.options.baseUrl}/api/devmode/pair/check?code=${encodeURIComponent(startRes.code)}`,
          { method: "GET" },
        );
        if (res?.status === "approved" && res.runnerToken && res.runnerId) {
          this.runnerToken = res.runnerToken;
          this.runnerId = res.runnerId;
          if (res.relayUrl) {
            this.relayUrl = res.relayUrl;
          }
          this.options.env.RUNNER_TOKEN = this.runnerToken;
          this.options.env.DEV_RUNNER_ID = this.runnerId;
          await this.options.tokenStore?.save({
            runnerToken: this.runnerToken,
            runnerId: this.runnerId,
            relayUrl: this.relayUrl,
          });
          this.events.onPairingSuccess?.({
            runnerId: this.runnerId,
            runnerToken: this.runnerToken,
            relayUrl: this.relayUrl,
          });
          this.log("info", "Pairing successful", { runnerId: this.runnerId });
          return;
        }
      } catch (err) {
        if (!isAbortError(err)) {
          this.log("warn", "Pairing check failed", { error: (err as Error).message });
        }
      }
    }
    if (this.signal.aborted) {
      throw new Error("Runner stopped before pairing completed");
    }
    throw new Error("Pairing failed");
  }

  private async startRelayIfNeeded() {
    if (this.relayHandle !== noopAsyncDisposable) return;
    const relayConfig: RelayOptions = {
      url: this.relayUrl ?? this.options.relay.url,
      token: this.runnerToken ?? this.options.relay.token,
    };
    this.relayHandle = await startRelayClient(this, this.signal, relayConfig);
  }

  private startHeartbeatLoop() {
    const token = this.runnerToken;
    if (!token) return;
    const url = `${this.options.baseUrl}/api/devmode/runners/heartbeat`;
    let consecutiveHeartbeatErrors = 0;
    const tick = async () => {
      if (this.signal.aborted) return;
      try {
        await this.fetchJson(
          url,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
          false,
        );
        consecutiveHeartbeatErrors = 0; // Reset on success
      } catch (err) {
        if (!isAbortError(err)) {
          consecutiveHeartbeatErrors++;
          // Only log every 5th error to avoid spam
          if (consecutiveHeartbeatErrors % 5 === 1) {
            this.log("warn", "Heartbeat failed", {
              error: (err as Error).message,
              baseUrl: this.options.baseUrl,
              consecutiveErrors: consecutiveHeartbeatErrors
            });
          }
        }
      }
    };
    tick().catch(() => {});
    this.heartbeatTimer = setInterval(() => {
      tick().catch(() => {});
    }, this.options.heartbeatIntervalMs);
  }

  private async registerRunner() {
    const res = await this.fetchJson(
      `${this.options.baseUrl}/api/devmode/runners/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: this.runnerId,
          name: this.options.runnerName,
          capabilities: ["node20", "pnpm"],
        }),
      },
    );
    if (!res) throw new Error("Register failed");
    this.log("info", "Runner registered", { runnerId: this.runnerId });
  }

  private async runnerLoop(): Promise<void> {
    const baseUrl = this.options.baseUrl;
    const env = this.options.env;
    const codexCmd = this.options.codex.command;
    const codexArgs = this.options.codex.args;
    let consecutiveErrors = 0;
    const maxBackoffMs = 60000; // Cap at 60 seconds

    while (!this.signal.aborted) {
      try {
        const poll = await this.fetchRaw(
          `${baseUrl}/api/devmode/jobs/poll?runnerId=${encodeURIComponent(this.runnerId)}`,
        );
        if (!poll.ok) {
          const payload = await poll.text();
          consecutiveErrors++;
          const backoffMs = Math.min(maxBackoffMs, 2000 * Math.pow(2, Math.min(consecutiveErrors - 1, 5)));
          this.log("warn", "Job poll failed", {
            status: poll.status,
            payload,
            baseUrl,
            consecutiveErrors,
            nextRetryMs: backoffMs
          });
          await waitFor(this.signal, backoffMs);
          continue;
        }
        consecutiveErrors = 0; // Reset on success
        const data = (await poll.json()) as { job: any | null; wsToken?: string };
        if (!data.job) {
          await waitFor(this.signal, this.options.jobPollIntervalMs);
          continue;
        }
        const job = data.job as { id: string; intent: string };
        const wsToken = data.wsToken as string;
        this.log("info", "Job received", { jobId: job.id, intent: job.intent });
        await this.ingest(job.id, wsToken, `runner ${this.runnerId} starting job ${job.id}`);
        await waitFor(this.signal, 400);
        await this.ingest(job.id, wsToken, `intent: ${job.intent}`);
        await waitFor(this.signal, 400);
        await this.ingest(job.id, wsToken, `setup complete`, "warn");
        if (codexCmd) {
          await this.ingest(job.id, wsToken, `spawning: ${codexCmd} ${codexArgs.join(" ")}`);
          await new Promise<void>((resolve) => {
            const child = spawn(codexCmd, codexArgs, {
              env: env as NodeJS.ProcessEnv,
              stdio: ["ignore", "pipe", "pipe"],
            });
            const forward = async (buf: Buffer, level: "info" | "warn") => {
              const line = String(buf).trimEnd();
              if (line) {
                await this.ingest(job.id, wsToken, line, level);
              }
            };
            child.stdout?.on("data", (buf: Buffer) => {
              forward(buf, "info").catch(() => {});
            });
            child.stderr?.on("data", (buf: Buffer) => {
              forward(buf, "warn").catch(() => {});
            });
            child.on("exit", async (code: number | null) => {
              await this.ingest(job.id, wsToken, `codex exited with code ${code ?? "null"}`);
              resolve();
            });
          });
        }
        const controller = new AbortController();
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        if (!this.signal.aborted) {
          const messages = await this.fetchRaw(
            `${baseUrl}/api/devmode/jobs/${encodeURIComponent(job.id)}/messages/stream`,
            { signal: controller.signal },
          );
          if (messages.ok && messages.body) {
            reader = messages.body.getReader();
            const decoder = new TextDecoder();
            (async () => {
              try {
                while (!this.signal.aborted) {
                  const { value, done } = await reader!.read();
                  if (done) break;
                  const chunk = decoder.decode(value);
                  for (const line of chunk.split("\n")) {
                    if (line.startsWith("data:")) {
                      try {
                        const evt = JSON.parse(line.slice(5).trim());
                        if (evt?.type === "message") {
                          await this.ingest(job.id, wsToken, `user: ${evt.content}`);
                        }
                      } catch {
                        /* ignore */
                      }
                    }
                  }
                }
              } catch (err) {
                if (!isAbortError(err)) {
                  this.log("warn", "Message stream error", { error: (err as Error).message });
                }
              }
            })().catch(() => {});
          }
        }

        await waitFor(this.signal, 1000);
        await this.ingest(job.id, wsToken, "done");
        await this.fetchRaw(`${baseUrl}/api/devmode/jobs/${encodeURIComponent(job.id)}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: "succeeded" }),
        }).catch(() => {});
        try {
          reader?.cancel().catch(() => {});
          controller.abort();
        } catch {
          /* noop */
        }
      } catch (err) {
        if (this.signal.aborted) break;
        consecutiveErrors++;
        const backoffMs = Math.min(maxBackoffMs, 2000 * Math.pow(2, Math.min(consecutiveErrors - 1, 5)));
        this.log("warn", "Runner loop error", {
          error: (err as Error).message,
          baseUrl,
          consecutiveErrors,
          nextRetryMs: backoffMs
        });
        await waitFor(this.signal, backoffMs);
      }
    }
  }

  private async ingest(jobId: string, token: string, line: string, level: "info" | "warn" | "error" = "info") {
    await this.fetchJson(
      `${this.options.baseUrl}/api/devmode/logs/ingest?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: [{ level, line }] }),
      },
      false,
    );
  }

  async fetchJson<T = unknown>(url: string, init?: RequestInit, throwOnError = true): Promise<T> {
    const res = await this.fetchRaw(url, init);
    if (!res.ok && throwOnError) {
      const text = await res.text().catch(() => "");
      throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
    }
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      if (throwOnError) {
        throw new Error(`Invalid JSON response (${url}): ${text}`);
      }
      return {} as T;
    }
  }

  private async fetchRaw(url: string, init?: RequestInit): Promise<Response> {
    return this.options.fetchImpl(url, init);
  }
}

export async function startRunner(options: RunnerOptions): Promise<RunnerHandle> {
  const core = new RunnerCore(options);
  await core.start();
  return core;
}
