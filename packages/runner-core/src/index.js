"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileTokenStore = createFileTokenStore;
exports.startRunner = startRunner;
const promises_1 = require("node:timers/promises");
const node_child_process_1 = require("node:child_process");
const defaultLogger = {
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
const noopAsyncDisposable = {
    async stop() {
        /* noop */
    },
};
function createFileTokenStore(appName = "Coda Runner") {
    async function getConfigPath() {
        const os = await Promise.resolve().then(() => __importStar(require("node:os")));
        const path = await Promise.resolve().then(() => __importStar(require("node:path")));
        const home = os.homedir();
        let dir = "";
        if (process.platform === "darwin") {
            dir = path.join(home, "Library", "Application Support", appName);
        }
        else if (process.platform === "win32") {
            dir = path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), appName);
        }
        else {
            dir = path.join(home, ".config", appName.replace(/\s+/g, "-").toLowerCase());
        }
        return { dir, file: path.join(dir, "config.json") };
    }
    return {
        async load() {
            try {
                const fs = await Promise.resolve().then(() => __importStar(require("node:fs/promises")));
                const { file } = await getConfigPath();
                const raw = await fs.readFile(file, "utf8").catch(() => "");
                if (!raw)
                    return null;
                const parsed = JSON.parse(raw);
                if (!parsed.runnerToken || !parsed.runnerId)
                    return null;
                return parsed;
            }
            catch {
                return null;
            }
        },
        async save(payload) {
            try {
                const fs = await Promise.resolve().then(() => __importStar(require("node:fs/promises")));
                const path = await Promise.resolve().then(() => __importStar(require("node:path")));
                const { dir, file } = await getConfigPath();
                await fs.mkdir(dir, { recursive: true });
                const tmp = path.join(dir, `.config.${Date.now()}.tmp`);
                await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
                await fs.rename(tmp, file);
            }
            catch {
                /* ignore */
            }
        },
        async clear() {
            try {
                const fs = await Promise.resolve().then(() => __importStar(require("node:fs/promises")));
                const { file } = await getConfigPath();
                await fs.rm(file, { force: true });
            }
            catch {
                /* ignore */
            }
        },
    };
}
function normalizeOptions(options) {
    const env = { ...process.env, ...(options.env ?? {}) };
    const baseUrl = options.baseUrl || env.BASE_URL || "http://localhost:3000";
    const runnerId = options.runnerId || env.DEV_RUNNER_ID || "";
    if (!runnerId) {
        throw new Error("runnerId is required (provide options.runnerId or DEV_RUNNER_ID)");
    }
    const runnerName = options.runnerName || env.DEV_RUNNER_NAME || runnerId || "Runner";
    const codexCommand = options.codex?.command || env.CODEX_CMD || null;
    const codexArgs = options.codex?.args ?? (env.CODEX_ARGS ? env.CODEX_ARGS.split(" ").filter(Boolean) : []);
    const enableTTY = options.enableTTY ?? true;
    const relay = {
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
    const ttyDefaults = {
        host: options.tty?.host ?? env.TTY_BIND ?? "127.0.0.1",
        port: options.tty?.port ?? Number(env.TTY_PORT ?? 8787),
        cwd: options.tty?.cwd ?? env.TTY_CWD ?? process.cwd(),
        sync: (options.tty?.sync ?? (String(env.TTY_SYNC || "").toLowerCase() === "tmux" ? "tmux" : "disabled")),
        sessionPrefix: options.tty?.sessionPrefix ?? env.TTY_SESSION_PREFIX ?? "coda",
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
async function chooseFolder() {
    return new Promise((resolve) => {
        const done = (value) => resolve(value && value.trim() ? value.trim() : null);
        try {
            const plat = process.platform;
            if (plat === "darwin") {
                const child = (0, node_child_process_1.spawn)("osascript", ["-e", 'POSIX path of (choose folder with prompt "Select project root")']);
                let out = "";
                child.stdout.on("data", (buf) => (out += String(buf)));
                child.on("close", () => done(out));
                child.on("error", () => done(null));
                return;
            }
            if (plat === "win32") {
                const script = `$f = (New-Object -ComObject Shell.Application).BrowseForFolder(0, 'Select project root', 0).Self; if ($f) { Write-Output $f.Path }`;
                const child = (0, node_child_process_1.spawn)("powershell", ["-NoProfile", "-Command", script]);
                let out = "";
                child.stdout.on("data", (buf) => (out += String(buf)));
                child.on("close", () => done(out));
                child.on("error", () => done(null));
                return;
            }
            const child = (0, node_child_process_1.spawn)("zenity", ["--file-selection", "--directory", "--title=Select project root"]);
            let out = "";
            child.stdout.on("data", (buf) => (out += String(buf)));
            child.on("close", () => done(out));
            child.on("error", () => done(null));
        }
        catch {
            done(null);
        }
    });
}
const stripAnsi = (s) => s.replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, "").replace(/[\r\t]+/g, "");
function isAbortError(err) {
    return err instanceof Error && err.name === "AbortError";
}
async function waitFor(signal, ms) {
    if (signal.aborted)
        return false;
    try {
        await (0, promises_1.setTimeout)(ms, undefined, { signal });
        return true;
    }
    catch (err) {
        if (isAbortError(err))
            return false;
        throw err;
    }
}
async function startTTYServer(ctx, signal) {
    if (!ctx.options.enableTTY)
        return noopAsyncDisposable;
    try {
        const ws = (await Promise.resolve().then(() => __importStar(require("ws"))));
        const pty = (await Promise.resolve().then(() => __importStar(require("node-pty"))));
        const host = ctx.options.tty.host;
        const port = ctx.options.tty.port;
        const { WebSocketServer } = ws;
        const server = new WebSocketServer({ host, port });
        const sockets = new Set();
        ctx.log("info", `TTY server listening ws://${host}:${port}/tty`);
        server.on("connection", (socket, req) => {
            sockets.add(socket);
            const destroy = () => {
                sockets.delete(socket);
                try {
                    socket.close();
                }
                catch {
                    /* noop */
                }
            };
            try {
                const url = new URL(req.url || "/tty", `http://${req.headers.host || "localhost"}`);
                if (url.pathname !== "/tty") {
                    socket.close(1008, "invalid path");
                    return;
                }
                ctx.log("info", "TTY client connected", { remote: req.socket?.remoteAddress });
                const shell = process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");
                const cols = Number(url.searchParams.get("cols") || 80);
                const rows = Number(url.searchParams.get("rows") || 24);
                let cwd = ctx.options.tty.cwd;
                const qpCwd = url.searchParams.get("cwd");
                if (qpCwd && qpCwd.trim() !== "") {
                    cwd = qpCwd;
                }
                const useTmux = ctx.options.tty.sync === "tmux";
                let cmd = shell;
                let args = [];
                if (useTmux) {
                    const sessionName = `${ctx.options.tty.sessionPrefix}-${Math.random().toString(36).slice(2, 8)}`;
                    cmd = "tmux";
                    args = ["new-session", "-A", "-s", sessionName, "-c", cwd];
                    ctx.log("info", `TTY tmux session ${sessionName}`);
                    try {
                        if (socket.readyState === 1)
                            socket.send(`coda:session:${sessionName}\n`);
                    }
                    catch {
                        /* noop */
                    }
                }
                const term = pty.spawn(cmd, args, {
                    name: "xterm-color",
                    cols,
                    rows,
                    cwd,
                    env: ctx.options.env,
                });
                let recording = null;
                term.onData(async (data) => {
                    if (socket.readyState === 1) {
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
                                await ctx.fetchJson(`${ctx.options.baseUrl}/api/devmode/logs/ingest?jobId=${encodeURIComponent(recording.jobId)}&token=${encodeURIComponent(recording.token)}`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ lines }),
                                }, false);
                            }
                        }
                        catch {
                            /* ignore */
                        }
                    }
                });
                socket.on("message", async (msg) => {
                    try {
                        const decoded = msg.toString();
                        if (decoded && decoded.startsWith("{")) {
                            const obj = JSON.parse(decoded);
                            if (obj?.type === "resize" && obj.cols && obj.rows) {
                                term.resize(Number(obj.cols), Number(obj.rows));
                                return;
                            }
                            if (obj?.type === "record" && obj.jobId && obj.token) {
                                recording = { jobId: String(obj.jobId), token: String(obj.token), buffer: "" };
                                ctx.log("info", `TTY recording enabled for job ${recording.jobId}`);
                                return;
                            }
                            if (obj?.type === "record-stop") {
                                const jobId = recording?.jobId;
                                recording = null;
                                if (jobId) {
                                    try {
                                        await ctx.fetchJson(`${ctx.options.baseUrl}/api/devmode/jobs/${encodeURIComponent(jobId)}/finish`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ state: "succeeded" }),
                                        }, false);
                                    }
                                    catch {
                                        /* ignore */
                                    }
                                }
                                return;
                            }
                            if (obj?.type === "pick-cwd") {
                                try {
                                    const path = await chooseFolder();
                                    if (socket.readyState === 1) {
                                        socket.send(path ? `coda:cwd:${path}\n` : `coda:error:No folder selected\n`);
                                    }
                                }
                                catch (e) {
                                    const msgText = e.message || String(e);
                                    if (socket.readyState === 1) {
                                        socket.send(`coda:error:${msgText}\n`);
                                    }
                                }
                                return;
                            }
                        }
                    }
                    catch {
                        /* ignore */
                    }
                    term.write(msg.toString());
                });
                const cleanup = async () => {
                    try {
                        term.kill();
                    }
                    catch {
                        /* noop */
                    }
                    if (recording?.jobId) {
                        const id = recording.jobId;
                        recording = null;
                        try {
                            await ctx.fetchJson(`${ctx.options.baseUrl}/api/devmode/jobs/${encodeURIComponent(id)}/finish`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ state: "succeeded" }),
                            }, false);
                        }
                        catch {
                            /* ignore */
                        }
                    }
                };
                socket.on("close", cleanup);
                socket.on("error", cleanup);
                signal.addEventListener("abort", () => {
                    cleanup().catch(() => { });
                    destroy();
                }, { once: true });
            }
            catch (err) {
                ctx.log("warn", "TTY connection error", { message: err.message });
                destroy();
            }
        });
        const stop = async () => {
            for (const socket of sockets) {
                try {
                    socket.close();
                }
                catch {
                    /* noop */
                }
            }
            await new Promise((resolve) => {
                server.close(() => resolve());
            });
        };
        signal.addEventListener("abort", () => {
            stop().catch(() => { });
        }, { once: true });
        return { stop };
    }
    catch (err) {
        ctx.log("warn", "TTY server disabled", { error: err.message });
        return noopAsyncDisposable;
    }
}
async function startRelayClient(ctx, signal, relay) {
    if (!relay.url || !relay.token) {
        return noopAsyncDisposable;
    }
    try {
        const wsMod = (await Promise.resolve().then(() => __importStar(require("ws"))));
        const pty = (await Promise.resolve().then(() => __importStar(require("node-pty"))));
        const sessions = new Map();
        let closed = false;
        const aborters = new Set();
        const connect = () => {
            if (signal.aborted || closed)
                return;
            const endpoint = new URL(relay.url);
            endpoint.pathname = "/runner";
            endpoint.searchParams.set("token", relay.token);
            const sock = new wsMod.WebSocket(endpoint.toString());
            const cleanupSession = async (sid) => {
                const sess = sessions.get(sid);
                if (!sess)
                    return;
                sessions.delete(sid);
                try {
                    sess.term.kill();
                }
                catch {
                    /* noop */
                }
            };
            const send = (obj) => {
                try {
                    if (sock.readyState === 1) {
                        sock.send(JSON.stringify(obj));
                    }
                }
                catch {
                    /* noop */
                }
            };
            const onClose = () => {
                if (closed || signal.aborted)
                    return;
                ctx.log("warn", "Relay disconnected; retrying in 2s");
                waitFor(signal, 2000).then((ok) => {
                    if (ok)
                        connect();
                });
            };
            sock.on("open", () => {
                ctx.log("info", "Relay connected");
            });
            sock.on("close", onClose);
            sock.on("error", (error) => {
                ctx.log("warn", "Relay error", { message: error.message });
            });
            sock.on("message", async (raw) => {
                let msg;
                try {
                    msg = JSON.parse(String(raw));
                }
                catch {
                    return;
                }
                const sessionId = String(msg.sessionId ?? "");
                if (!sessionId)
                    return;
                if (msg.type === "session-open") {
                    try {
                        const shell = process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");
                        const cols = Number(msg.cols || 80);
                        const rows = Number(msg.rows || 24);
                        const cwd = ctx.options.tty.cwd;
                        const term = pty.spawn(shell, [], { name: "xterm-color", cols, rows, cwd, env: ctx.options.env });
                        const sess = { term, recording: null };
                        sessions.set(sessionId, sess);
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
                                        await ctx.fetchJson(`${ctx.options.baseUrl}/api/devmode/logs/ingest?jobId=${encodeURIComponent(sess.recording.jobId)}&token=${encodeURIComponent(sess.recording.token)}`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ lines }),
                                        }, false);
                                    }
                                }
                                catch {
                                    /* ignore */
                                }
                            }
                        });
                        term.onExit(async () => {
                            await cleanupSession(sessionId);
                        });
                    }
                    catch (error) {
                        ctx.log("warn", "Relay session-open failed", { message: error.message });
                    }
                    return;
                }
                const sess = sessions.get(sessionId);
                if (!sess)
                    return;
                if (msg.type === "stdin" && typeof msg.data === "string") {
                    try {
                        sess.term.write(msg.data);
                    }
                    catch {
                        /* noop */
                    }
                    return;
                }
                if (msg.type === "resize" && msg.cols && msg.rows) {
                    try {
                        sess.term.resize(Number(msg.cols), Number(msg.rows));
                    }
                    catch {
                        /* noop */
                    }
                    return;
                }
                if (msg.type === "record" && msg.jobId && msg.token) {
                    sess.recording = { jobId: String(msg.jobId), token: String(msg.token), buffer: "" };
                    return;
                }
                if (msg.type === "pick-cwd") {
                    try {
                        const path = await chooseFolder();
                        const data = path ? `coda:cwd:${path}\n` : `coda:error:No folder selected\n`;
                        send({ type: "meta", sessionId, data });
                    }
                    catch (error) {
                        send({
                            type: "meta",
                            sessionId,
                            data: `coda:error:${error.message}\n`,
                        });
                    }
                    return;
                }
            });
            const abort = () => {
                try {
                    sock.terminate();
                }
                catch {
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
                }
                catch {
                    /* noop */
                }
            }
        };
        signal.addEventListener("abort", () => {
            stop().catch(() => { });
        }, { once: true });
        return { stop };
    }
    catch (err) {
        ctx.log("warn", "Relay client disabled", { error: err.message });
        return noopAsyncDisposable;
    }
}
class RunnerCore {
    options;
    controller;
    externalSignal;
    heartbeatTimer = null;
    runnerLoopPromise = null;
    statusValue = "initializing";
    stopped = false;
    ttyHandle = noopAsyncDisposable;
    relayHandle = noopAsyncDisposable;
    runnerToken;
    runnerId;
    relayUrl;
    constructor(options) {
        this.options = normalizeOptions(options);
        this.runnerId = this.options.runnerId;
        this.controller = new AbortController();
        this.externalSignal = options.signal;
        if (this.externalSignal) {
            if (this.externalSignal.aborted) {
                this.controller.abort();
            }
            else {
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
    status() {
        return this.statusValue;
    }
    get signal() {
        return this.controller.signal;
    }
    get logger() {
        return this.options.logger;
    }
    get events() {
        return this.options.events;
    }
    setStatus(status) {
        if (this.statusValue === status)
            return;
        this.statusValue = status;
        this.events.onStatusChange?.(status);
    }
    log(level, message, context) {
        const entry = { level, message, context };
        const logger = this.logger;
        logger[level](message, context);
        this.events.onLog?.(entry);
    }
    async start() {
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
            if (this.signal.aborted)
                return;
            this.setStatus("error");
            this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
            this.log("error", "Runner loop failed", { error: err?.message ?? String(err) });
        });
    }
    async stop() {
        if (this.stopped)
            return;
        this.stopped = true;
        this.controller.abort();
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        try {
            await this.ttyHandle.stop();
        }
        catch {
            /* noop */
        }
        try {
            await this.relayHandle.stop();
        }
        catch {
            /* noop */
        }
        if (this.runnerLoopPromise) {
            try {
                await this.runnerLoopPromise;
            }
            catch {
                /* ignore */
            }
        }
        this.setStatus("stopped");
    }
    async ensureRunnerToken() {
        if (this.runnerToken)
            return;
        const envToken = this.options.env.RUNNER_TOKEN;
        if (envToken) {
            this.runnerToken = envToken;
            return;
        }
        const storeToken = await this.options.tokenStore?.load();
        if (storeToken?.runnerToken && storeToken.runnerId) {
            this.runnerToken = storeToken.runnerToken;
            this.runnerId = storeToken.runnerId;
            if (storeToken.relayUrl)
                this.relayUrl = storeToken.relayUrl;
            this.options.env.RUNNER_TOKEN = storeToken.runnerToken;
            return;
        }
        this.setStatus("pairing");
        const startRes = await this.fetchJson(`${this.options.baseUrl}/api/devmode/pair/start`, { method: "POST" });
        const expiresAt = new Date(startRes.expiresAt);
        this.events.onPairingCode?.({ code: startRes.code, expiresAt });
        this.log("info", "Pairing code issued", { code: startRes.code, expiresAt: expiresAt.toISOString() });
        const deadline = expiresAt.getTime();
        while (!this.signal.aborted) {
            const waited = await waitFor(this.signal, this.options.pairingPollIntervalMs);
            if (!waited)
                break;
            if (Date.now() > deadline) {
                this.events.onError?.(new Error("Pairing expired"));
                throw new Error("Pairing expired");
            }
            try {
                const res = await this.fetchJson(`${this.options.baseUrl}/api/devmode/pair/check?code=${encodeURIComponent(startRes.code)}`, { method: "GET" });
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
            }
            catch (err) {
                if (!isAbortError(err)) {
                    this.log("warn", "Pairing check failed", { error: err.message });
                }
            }
        }
        if (this.signal.aborted) {
            throw new Error("Runner stopped before pairing completed");
        }
        throw new Error("Pairing failed");
    }
    async startRelayIfNeeded() {
        if (this.relayHandle !== noopAsyncDisposable)
            return;
        const relayConfig = {
            url: this.relayUrl ?? this.options.relay.url,
            token: this.runnerToken ?? this.options.relay.token,
        };
        this.relayHandle = await startRelayClient(this, this.signal, relayConfig);
    }
    startHeartbeatLoop() {
        const token = this.runnerToken;
        if (!token)
            return;
        const url = `${this.options.baseUrl}/api/devmode/runners/heartbeat`;
        const tick = async () => {
            if (this.signal.aborted)
                return;
            try {
                await this.fetchJson(url, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                }, false);
            }
            catch (err) {
                if (!isAbortError(err)) {
                    this.log("warn", "Heartbeat failed", { error: err.message });
                }
            }
        };
        tick().catch(() => { });
        this.heartbeatTimer = setInterval(() => {
            tick().catch(() => { });
        }, this.options.heartbeatIntervalMs);
    }
    async registerRunner() {
        const res = await this.fetchJson(`${this.options.baseUrl}/api/devmode/runners/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: this.runnerId,
                name: this.options.runnerName,
                capabilities: ["node20", "pnpm"],
            }),
        });
        if (!res)
            throw new Error("Register failed");
        this.log("info", "Runner registered", { runnerId: this.runnerId });
    }
    async runnerLoop() {
        const baseUrl = this.options.baseUrl;
        const env = this.options.env;
        const codexCmd = this.options.codex.command;
        const codexArgs = this.options.codex.args;
        while (!this.signal.aborted) {
            try {
                const poll = await this.fetchRaw(`${baseUrl}/api/devmode/jobs/poll?runnerId=${encodeURIComponent(this.runnerId)}`);
                if (!poll.ok) {
                    const payload = await poll.text();
                    this.log("warn", "Job poll failed", { status: poll.status, payload });
                    await waitFor(this.signal, 2000);
                    continue;
                }
                const data = (await poll.json());
                if (!data.job) {
                    await waitFor(this.signal, this.options.jobPollIntervalMs);
                    continue;
                }
                const job = data.job;
                const wsToken = data.wsToken;
                this.log("info", "Job received", { jobId: job.id, intent: job.intent });
                await this.ingest(job.id, wsToken, `runner ${this.runnerId} starting job ${job.id}`);
                await waitFor(this.signal, 400);
                await this.ingest(job.id, wsToken, `intent: ${job.intent}`);
                await waitFor(this.signal, 400);
                await this.ingest(job.id, wsToken, `setup complete`, "warn");
                if (codexCmd) {
                    await this.ingest(job.id, wsToken, `spawning: ${codexCmd} ${codexArgs.join(" ")}`);
                    await new Promise((resolve) => {
                        const child = (0, node_child_process_1.spawn)(codexCmd, codexArgs, {
                            env: env,
                            stdio: ["ignore", "pipe", "pipe"],
                        });
                        const forward = async (buf, level) => {
                            const line = String(buf).trimEnd();
                            if (line) {
                                await this.ingest(job.id, wsToken, line, level);
                            }
                        };
                        child.stdout?.on("data", (buf) => {
                            forward(buf, "info").catch(() => { });
                        });
                        child.stderr?.on("data", (buf) => {
                            forward(buf, "warn").catch(() => { });
                        });
                        child.on("exit", async (code) => {
                            await this.ingest(job.id, wsToken, `codex exited with code ${code ?? "null"}`);
                            resolve();
                        });
                    });
                }
                const controller = new AbortController();
                let reader = null;
                if (!this.signal.aborted) {
                    const messages = await this.fetchRaw(`${baseUrl}/api/devmode/jobs/${encodeURIComponent(job.id)}/messages/stream`, { signal: controller.signal });
                    if (messages.ok && messages.body) {
                        reader = messages.body.getReader();
                        const decoder = new TextDecoder();
                        (async () => {
                            try {
                                while (!this.signal.aborted) {
                                    const { value, done } = await reader.read();
                                    if (done)
                                        break;
                                    const chunk = decoder.decode(value);
                                    for (const line of chunk.split("\n")) {
                                        if (line.startsWith("data:")) {
                                            try {
                                                const evt = JSON.parse(line.slice(5).trim());
                                                if (evt?.type === "message") {
                                                    await this.ingest(job.id, wsToken, `user: ${evt.content}`);
                                                }
                                            }
                                            catch {
                                                /* ignore */
                                            }
                                        }
                                    }
                                }
                            }
                            catch (err) {
                                if (!isAbortError(err)) {
                                    this.log("warn", "Message stream error", { error: err.message });
                                }
                            }
                        })().catch(() => { });
                    }
                }
                await waitFor(this.signal, 1000);
                await this.ingest(job.id, wsToken, "done");
                await this.fetchRaw(`${baseUrl}/api/devmode/jobs/${encodeURIComponent(job.id)}/finish`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ state: "succeeded" }),
                }).catch(() => { });
                try {
                    reader?.cancel().catch(() => { });
                    controller.abort();
                }
                catch {
                    /* noop */
                }
            }
            catch (err) {
                if (this.signal.aborted)
                    break;
                this.log("warn", "Runner loop error", { error: err.message });
                await waitFor(this.signal, 2000);
            }
        }
    }
    async ingest(jobId, token, line, level = "info") {
        await this.fetchJson(`${this.options.baseUrl}/api/devmode/logs/ingest?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines: [{ level, line }] }),
        }, false);
    }
    async fetchJson(url, init, throwOnError = true) {
        const res = await this.fetchRaw(url, init);
        if (!res.ok && throwOnError) {
            const text = await res.text().catch(() => "");
            throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
        }
        const text = await res.text();
        if (!text)
            return {};
        try {
            return JSON.parse(text);
        }
        catch (err) {
            if (throwOnError) {
                throw new Error(`Invalid JSON response (${url}): ${text}`);
            }
            return {};
        }
    }
    async fetchRaw(url, init) {
        return this.options.fetchImpl(url, init);
    }
}
async function startRunner(options) {
    const core = new RunnerCore(options);
    await core.start();
    return core;
}
