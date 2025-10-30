"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, History } from "lucide-react";

// Lazy import xterm to keep client bundle lean until needed
let TerminalImpl: any;
let FitAddonImpl: any;

async function loadXterm() {
  if (!TerminalImpl) {
    const [xtermMod, fitAddonMod] = await Promise.all([
      // Load on demand only
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);
    TerminalImpl = (xtermMod as any).Terminal;
    FitAddonImpl = (fitAddonMod as any).FitAddon;
  }
}

export function TerminalPane({
  runnerId,
  initialUrl,
  onUrlChange,
  visible = true,
  onOutput,
  ideaId,
  projectRoot,
  codexSessionId,
  onProjectRootDetected,
  onRegisterPicker,
  requireProjectRoot = true,
  autoAgent = false,
  onCodexSessionDetected,
  autoConnect = false,
  onNoRunner,
  sessionSlot,
  onConnectionChange,
  pathHistory = [],
  onPathSelected,
}: {
  runnerId?: string | null;
  initialUrl?: string;
  onUrlChange?: (url: string) => void;
  visible?: boolean;
  onOutput?: (text: string) => void;
  ideaId?: string;
  projectRoot?: string | null;
  codexSessionId?: string | null;
  onProjectRootDetected?: (path: string) => void;
  onRegisterPicker?: (fn: () => void) => void;
  requireProjectRoot?: boolean;
  autoAgent?: boolean;
  onCodexSessionDetected?: (id: string) => void;
  autoConnect?: boolean;
  onNoRunner?: () => void;
  sessionSlot?: string;
  onConnectionChange?: (connected: boolean) => void;
  pathHistory?: string[];
  onPathSelected?: (path: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const firstMessageRef = useRef(true);
  const [wsUrl, setWsUrl] = useState<string>(initialUrl || "");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionNameExpanded, setSessionNameExpanded] = useState(false);
  const [recordingJobId, setRecordingJobId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const awaitingSessionRef = useRef<boolean>(false);
  const usingRelayRef = useRef<boolean>(false);
  const lastConnectAtRef = useRef<number>(0);
  const suppressReconnectUntilRef = useRef<number>(0);
  const [showPathHistory, setShowPathHistory] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const pathHistoryRef = useRef<HTMLDivElement>(null);

  // Default URL: local dev, or derive from runnerId using a common pattern
  const defaultUrl = useMemo(() => {
    if (typeof window !== "undefined" && location.hostname === "localhost") {
      return "ws://localhost:8787/tty";
    }
    if (runnerId) {
      // Pattern hint: dev-<runnerId>.codacli.com → you can override in the input
      return `wss://dev-${runnerId}.codacli.com/tty`;
    }
    return "";
  }, [runnerId]);

  useEffect(() => {
    if (!wsUrl && (initialUrl || defaultUrl)) {
      const next = initialUrl || defaultUrl;
      setWsUrl(next);
      onUrlChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUrl, initialUrl]);

  useEffect(() => {
    const onResize = () => {
      try {
        fitRef.current?.fit?.();
      } catch {}
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // When a hidden terminal becomes visible, refit it so cursor and content align.
  useEffect(() => {
    if (visible) {
      try { fitRef.current?.fit?.(); } catch {}
    }
  }, [visible]);

  // Auto-connect when visible and requested
  useEffect(() => {
    if (!visible || !autoConnect) return;
    if (connected || connecting) return;
    // Require container to exist before attempting connect to avoid loops
    if (!containerRef.current) return;
    const now = Date.now();
    if (now < suppressReconnectUntilRef.current) return;
    // Throttle attempts
    if (now - lastConnectAtRef.current < 800) return;
    if (!wsUrl && defaultUrl) {
      setWsUrl(defaultUrl);
      // wait for state to update; connect on next tick
      queueMicrotask(() => {
        if (!connected && !connecting && containerRef.current) void connect();
      });
      return;
    }
    if (wsUrl) {
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoConnect, wsUrl, defaultUrl, connected, connecting, containerRef.current]);

  const connect = async () => {
    if (connected || connecting) return;
    if (requireProjectRoot && (!projectRoot || projectRoot.trim() === "")) {
      // Soft guard: encourage setting Project Root first
      alert("Tip: Set the Project Root (use Pick Folder…) so new terminals open in the right directory.");
    }
    setConnecting(true);
    try {
      await loadXterm();
      lastConnectAtRef.current = Date.now();
      // Close any previous socket before opening a new one
      try { wsRef.current?.close(); } catch {}
      // Determine connection target: Relay session (preferred) or manual URL
      usingRelayRef.current = false;
      let base = (wsUrl || "").trim();
      let sessionToken: string | null = null;
      let relayUrl: string | null = null;
      const relayEnabled = process.env.NEXT_PUBLIC_DEVMODE_RELAY_ENABLED === "1";
      if (relayEnabled && ideaId) {
        try {
          const res = await fetch("/api/devmode/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ideaId,
              runnerId: runnerId || null,
              projectRoot: projectRoot || null,
              sessionSlot: sessionSlot || "slot-1",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            sessionToken = data.token as string;
            relayUrl = data.relayUrl as string;
          }
        } catch {}
      }
      if (sessionToken && relayUrl) {
        usingRelayRef.current = true;
        try {
          const u = new URL(relayUrl);
          u.pathname = "/client";
          u.searchParams.set("token", sessionToken);
          base = u.toString();
        } catch {
          usingRelayRef.current = false;
        }
      }
      if (!usingRelayRef.current) {
        // Manual/Direct mode: normalize/ensure absolute ws(s) URL; fall back to default
        if (!base) base = initialUrl || defaultUrl;
        try {
          const u = new URL(base);
          if (!/\/tty\/?$/.test(u.pathname)) {
            const p = u.pathname.replace(/\/+$/, "");
            u.pathname = p + "/tty";
          }
          base = u.toString();
        } catch {
          base = defaultUrl;
        }
      }
      const term = new TerminalImpl({
        convertEol: true,
        fontSize: 13,
        theme: { background: "#0b0b10", foreground: "#ffffff" },
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 1000,
      });
      const fit = new FitAddonImpl();
      term.loadAddon(fit);
      termRef.current = term;
      fitRef.current = fit;
      const el = containerRef.current;
      if (!el) {
        // Give the ref one more frame to settle, then retry once without spamming
        setConnecting(false);
        requestAnimationFrame(() => {
          if (!connected && !connecting && containerRef.current) void connect();
        });
        return;
      }
      // Give CSS a tick to apply to avoid visible measurement artifacts (e.g., 'W' spam)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // Ensure container is empty before attaching a new terminal instance
      try { el.innerHTML = ""; } catch {}
      term.open(el);
      // Fit on next tick for stability, then clear and reveal
      setTimeout(() => {
        try {
          fit.fit();
          // Full reset of terminal state/buffer before revealing
          term.reset();
          // Clear screen and move cursor home to avoid any stray glyphs
          term.write("\x1b[2J\x1b[H");
        } catch {}
        setReady(true);
      }, 0);

      const buildUrl = (abs: string) => {
        const u = new URL(abs);
        if (projectRoot && !u.searchParams.get("cwd")) {
          u.searchParams.set("cwd", projectRoot);
        }
        return u.toString();
      };
      const ws = new WebSocket(buildUrl(base));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        setConnected(true);
        onConnectionChange?.(true);
        setConnecting(false);
        fit.fit();
        term.focus();
        // Do not print banners inside the terminal; keep the surface clean.
        try {
          // Send an initial resize to sync server-side PTY size
          const cols = (term as any)._core?._renderService?._renderer?._dimensions?.actualCellWidth
            ? (term as any).cols
            : (term as any).cols;
          const rows = (term as any).rows;
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols, rows }));
        } catch {}

        // Auto-enable recording by creating a job and sending record control
        if (ideaId) {
          try {
            const idem = crypto.randomUUID();
            const res = await fetch("/api/devmode/jobs", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
              body: JSON.stringify({ ideaId, intent: "terminal-record", idempotencyKey: idem }),
            });
            if (res.ok) {
              const data = await res.json();
              const jobId = data.jobId as string;
              const token = data.wsToken as string;
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "record", jobId, token }));
              setRecordingJobId(jobId);
            } else {
              try { term.writeln("\x1b[31mRecording failed to start (job create).\x1b[0m"); } catch {}
            }
          } catch {
            try { term.writeln("\x1b[31mRecording failed to start (network).\x1b[0m"); } catch {}
          }
        }

        // Note: We do NOT inject Codex env vars in regular terminals.
        // Agent sessions are handled below via explicit codex/codex resume commands when autoAgent is true.

        // Auto-run Codex agent if requested
        try {
          if (autoAgent) {
            if (codexSessionId && codexSessionId.trim() !== "") {
              ws.send(`codex resume ${codexSessionId}\r`);
              term.writeln(`\x1b[33mResuming Codex session ${codexSessionId}...\x1b[0m`);
            } else {
              awaitingSessionRef.current = true;
              ws.send(`codex\r`);
              term.writeln(`\x1b[33mStarting new Codex session...\x1b[0m`);
            }
          }
        } catch {}
      };
      // Strip ANSI for UI combined feed (keep raw for terminal rendering)
      const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, "");
      ws.onmessage = (ev) => {
        const toText = (d: any) => (d instanceof ArrayBuffer ? new TextDecoder().decode(new Uint8Array(d)) : String(d));
        let raw = toText(ev.data);
        if (usingRelayRef.current && typeof raw === "string" && raw.trim().startsWith("{")) {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === "object") {
              if (obj.type === "stdout" && typeof obj.data === "string") raw = obj.data;
              else if (obj.type === "meta" && typeof obj.data === "string") raw = obj.data;
              else return; // unknown control, ignore
            }
          } catch {}
        }
        // Suppress the very first chunk from the PTY (often shell/banner/artifacts) for a cleaner start.
        if (firstMessageRef.current) {
          firstMessageRef.current = false;
          try { if (ws.readyState === WebSocket.OPEN) ws.send("\r"); } catch {}
          return;
        }
        // Out-of-band control: capture tmux session name without rendering the raw line
        if (raw.startsWith("coda:session:")) {
          const name = raw.trim().slice("coda:session:".length);
          if (name) setSessionName(name);
          return;
        }
        if (raw.startsWith("coda:cwd:")) {
          const path = raw.trim().slice("coda:cwd:".length);
          if (path) {
            try { onProjectRootDetected?.(path); } catch {}
          }
          return;
        }
        // Detect Codex session ids in output (for new sessions)
        if (awaitingSessionRef.current || (autoAgent && !codexSessionId)) {
          try {
            const m = raw.match(/(?:codex\s*session\s*id\s*[:\-]?\s*|session\s*id\s*[:\-]?\s*|resume\s+)([0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})/i)
              || raw.match(/\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b/);
            const sid = m && (m[1] || m[0]);
            if (sid) {
              awaitingSessionRef.current = false;
              try { onCodexSessionDetected?.(sid); } catch {}
              try { term.writeln(`\x1b[35mDetected Codex session: ${sid}\x1b[0m`); } catch {}
            }
          } catch {}
        }

        term.write(raw);
        try { onOutput?.(stripAnsi(raw)); } catch {}
      };
      ws.onclose = (ev) => {
        setConnected(false);
        onConnectionChange?.(false);
        setConnecting(false);
        // Back off reconnects for common server-close reasons
        if (usingRelayRef.current && (ev.code === 1013 || ev.code === 1008 || ev.code === 1006)) {
          suppressReconnectUntilRef.current = Date.now() + 3000;
          if (ev.code === 1013) {
            try { onNoRunner?.(); } catch {}
          }
        }
      };
      ws.onerror = () => {
        setConnected(false);
        onConnectionChange?.(false);
        setConnecting(false);
      };

      const onData = (data: string) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (usingRelayRef.current) {
          try { ws.send(JSON.stringify({ type: "stdin", data })); } catch {}
        } else {
          ws.send(data);
        }
      };
      term.onData(onData);
    } catch (err) {
      console.error(err);
      setConnecting(false);
    }
  };

  const disconnect = () => {
    try {
      wsRef.current?.close();
    } catch {}
    try {
      termRef.current?.dispose?.();
    } catch {}
    setConnected(false);
    onConnectionChange?.(false);
    setConnecting(false);
  };

  // Expose a picker trigger to the dock (uses active terminal connection)
  useEffect(() => {
    if (!onRegisterPicker) return;
    const trigger = () => {
      try {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "pick-cwd" }));
      } catch {}
    };
    onRegisterPicker(trigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterPicker, wsRef.current, connected]);

  // Send resize messages to PTY only when terminal dimensions actually change
  useEffect(() => {
    if (!connected) return;
    const term = termRef.current;
    const ws = wsRef.current;
    if (!term || !ws) return;

    let lastCols = term.cols;
    let lastRows = term.rows;

    const checkResize = () => {
      try {
        if (ws.readyState !== WebSocket.OPEN) return;
        const cols = term.cols;
        const rows = term.rows;
        // Only send resize if dimensions actually changed
        if (cols !== lastCols || rows !== lastRows) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
          lastCols = cols;
          lastRows = rows;
        }
      } catch {}
    };

    // Check for size changes every 2 seconds (reduced frequency)
    const id = setInterval(checkResize, 2000);
    return () => clearInterval(id);
  }, [connected]);

  // Handle path selection from history
  const selectPath = (path: string) => {
    onProjectRootDetected?.(path);
    onPathSelected?.(path);
    setShowPathHistory(false);
    setSelectedHistoryIndex(-1);
  };

  // Handle keyboard navigation in path history dropdown
  const handlePathHistoryKeyDown = (e: React.KeyboardEvent) => {
    if (!showPathHistory || pathHistory.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedHistoryIndex((prev) =>
        prev < pathHistory.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedHistoryIndex((prev) =>
        prev > 0 ? prev - 1 : pathHistory.length - 1
      );
    } else if (e.key === "Enter" && selectedHistoryIndex >= 0) {
      e.preventDefault();
      selectPath(pathHistory[selectedHistoryIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowPathHistory(false);
      setSelectedHistoryIndex(-1);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pathHistoryRef.current && !pathHistoryRef.current.contains(event.target as Node)) {
        setShowPathHistory(false);
        setSelectedHistoryIndex(-1);
      }
    };

    if (showPathHistory) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPathHistory]);

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {process.env.NEXT_PUBLIC_DEVMODE_RELAY_ENABLED === "1" ? null : (
            <Input
              value={wsUrl}
              onChange={(e) => {
                setWsUrl(e.target.value);
                onUrlChange?.(e.target.value);
              }}
              placeholder="ws://localhost:8787/tty or wss://dev-<runner>.codacli.com/tty"
              className="sm:flex-1"
            />
          )}
          {!connected ? (
            <Button onClick={connect} disabled={connecting || (!wsUrl && process.env.NEXT_PUBLIC_DEVMODE_RELAY_ENABLED !== "1") } className="w-full sm:w-auto">
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={disconnect} className="w-full sm:w-auto">
              Disconnect
            </Button>
          )}
        </div>

        {/* Status indicators - stacked on mobile */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center text-xs">
          <span className={`inline-flex w-fit rounded px-2 py-0.5 ${connected ? "bg-green-600/20 text-green-600" : connecting ? "bg-yellow-600/20 text-yellow-700" : "bg-gray-500/20 text-gray-600"}`}>
            {connected ? "Connected" : connecting ? "Connecting…" : "Disconnected"}
          </span>
          {recordingJobId ? (
            <div className="flex flex-wrap items-center gap-2 rounded border bg-muted px-2 py-1">
              <span className="font-semibold">Recording</span>
              <code className="rounded bg-background px-1 py-0.5">{recordingJobId.slice(0, 8)}…</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(recordingJobId)}
              >
                Copy
              </Button>
            </div>
          ) : null}
          {sessionName ? (
            <div className="flex flex-wrap items-center gap-2 rounded border bg-muted px-2 py-1">
              <span className="font-semibold">Session</span>
              <button
                onClick={() => setSessionNameExpanded(!sessionNameExpanded)}
                className="rounded bg-background px-1 py-0.5 font-mono text-xs hover:bg-accent transition-colors cursor-pointer"
                title={sessionNameExpanded ? "Click to collapse" : "Click to expand"}
              >
                {sessionNameExpanded ? (
                  <span className="break-all">{sessionName}</span>
                ) : (
                  <span>
                    {sessionName.length > 20 ? `${sessionName.slice(0, 20)}…` : sessionName}
                  </span>
                )}
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(`tmux attach -t ${sessionName}`)}
                title={`Copy: tmux attach -t ${sessionName}`}
              >
                Copy attach
              </Button>
            </div>
          ) : null}
          {pathHistory.length > 0 && (
            <div className="relative" ref={pathHistoryRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPathHistory(!showPathHistory);
                  setSelectedHistoryIndex(-1);
                }}
                onKeyDown={handlePathHistoryKeyDown}
                className="flex items-center gap-1"
              >
                <History className="h-3 w-3" />
                <span className="text-xs">
                  {projectRoot && pathHistory.includes(projectRoot)
                    ? projectRoot.split("/").pop()
                    : "Recent Paths"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              {showPathHistory && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                  {pathHistory.map((path, index) => (
                    <button
                      key={index}
                      onClick={() => selectPath(path)}
                      onMouseEnter={() => setSelectedHistoryIndex(index)}
                      className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                        selectedHistoryIndex === index
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="truncate font-mono">{path}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {requireProjectRoot && (!projectRoot || projectRoot.trim() === "") ? (
          <div className="text-xs text-muted-foreground">
            Tip: set Project Root above (Pick Folder…) so terminals open in the right directory.
          </div>
        ) : null}
        <div
          ref={containerRef}
          className="h-72 w-full overflow-hidden rounded border bg-black"
          style={{ lineHeight: 1.2, opacity: ready ? 1 : 0 }}
        />
      </CardContent>
    </Card>
  );
}
