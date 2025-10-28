"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TerminalPane } from "./TerminalPane";
import { X, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string;
  title: string;
  url: string;
  minimized: boolean;
  include: boolean;
  mode: "terminal" | "agent";
};

type CombinedLine = { ts: number; sessionId: string; text: string };

export function TerminalDock({ ideaId, runnerId }: { ideaId: string; runnerId?: string | null }) {
  const storageKey = useMemo(() => `coda:terminals:${ideaId}`, [ideaId]);
  const projectRootKey = useMemo(() => `coda:projectRoot:${ideaId}`, [ideaId]);
  const codexSessionKey = useMemo(() => `coda:codexSession:${ideaId}`, [ideaId]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [combined, setCombined] = useState<CombinedLine[]>([]);
  const [follow, setFollow] = useState(false);
  const [combinedRef, setCombinedRef] = useState<HTMLDivElement | null>(null);
  const [projectRoot, setProjectRoot] = useState<string>("");
  const [codexSession, setCodexSession] = useState<string>("");
  const pickersRef = useRef<Record<string, () => void>>({});
  const [picking, setPicking] = useState(false);
  const [noRunner, setNoRunner] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    let timer: any;
    const poll = async () => {
      try {
        const res = await fetch("/api/devmode/runners/online", { cache: "no-store" as RequestCache });
        if (res.ok) {
          const data = await res.json();
          setOnline(!!data.online);
        }
      } catch {}
      timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => { try { clearTimeout(timer); } catch {} };
  }, [isClient]);

  // Load any saved sessions (titles/urls) — note: connections are not auto-restored.
  useEffect(() => {
    if (!isClient) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = (JSON.parse(raw) as any[]).map((s) => ({ include: true, mode: (s as any).mode || "terminal", ...s })) as Session[];
        setSessions(parsed);
        if (parsed.length) setActiveId(parsed[0].id);
      }
      const pr = localStorage.getItem(projectRootKey) || "";
      setProjectRoot(pr);
      const cs = localStorage.getItem(codexSessionKey) || "";
      setCodexSession(cs);
    } catch {}
  }, [storageKey, projectRootKey, codexSessionKey, isClient]);

  const persist = (next: Session[]) => {
    setSessions(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const persistProjectRoot = (value: string) => {
    setProjectRoot(value);
    try { localStorage.setItem(projectRootKey, value); } catch {}
  };

  const notifyRootSet = (path: string) => {
    persistProjectRoot(path);
    try {
      // Clipboard write may require user gesture and focused, secure context.
      if (typeof document !== "undefined" && document.hasFocus() && typeof navigator !== "undefined" && (navigator as any).clipboard && (window as any).isSecureContext) {
        // Fire and forget
        (navigator as any).clipboard.writeText(path).catch(() => {});
        toast.success("Project Root set", { description: path });
      } else {
        toast.success("Project Root set", {
          description: path,
          // Offer an explicit copy action when backgrounded or not permitted.
          action: { label: "Copy", onClick: () => (navigator as any)?.clipboard?.writeText(path).catch(() => {}) },
        } as any);
      }
    } catch {
      toast.success("Project Root set", {
        description: path,
        action: { label: "Copy", onClick: () => (navigator as any)?.clipboard?.writeText(path).catch(() => {}) },
      } as any);
    }
  };

  const persistCodexSession = (value: string) => {
    setCodexSession(value);
    try { localStorage.setItem(codexSessionKey, value); } catch {}
  };

  const computeDefaultWsUrl = () => {
    if (typeof window !== "undefined" && location.hostname === "localhost") {
      return "ws://localhost:8787/tty";
    }
    if (runnerId) return `wss://dev-${runnerId}.codacli.com/tty`;
    return "";
  };

  // Fallback picker when no terminal is connected: open a short-lived WS just to pick
  const pickFolderNoTerminal = async () => {
    setPicking(true);
    try {
      // Try relay first if enabled
      let wsUrl = "";
      const relayEnabled = process.env.NEXT_PUBLIC_DEVMODE_RELAY_ENABLED === "1";
      if (relayEnabled && ideaId && runnerId) {
        try {
          const res = await fetch("/api/devmode/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ideaId,
              runnerId,
              projectRoot: projectRoot || null,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const relayUrl = new URL(data.relayUrl as string);
            relayUrl.pathname = "/client";
            relayUrl.searchParams.set("token", data.token as string);
            wsUrl = relayUrl.toString();
          }
        } catch {
          // Fall through to direct mode
        }
      }

      // Fallback to direct mode
      if (!wsUrl) {
        wsUrl = computeDefaultWsUrl();
        if (!wsUrl) {
          toast.error("No terminal URL available. Connect a terminal first or set a runner.");
          return;
        }
      }

      await new Promise<void>((resolve) => {
        const ws = new WebSocket(wsUrl);
        // @ts-ignore
        ws.binaryType = "arraybuffer";
        const cleanup = () => { try { ws.close(); } catch {} resolve(); };
        ws.onopen = () => {
          try { ws.send(JSON.stringify({ type: "pick-cwd" })); } catch { cleanup(); }
        };
        ws.onmessage = (ev) => {
          let text = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(new Uint8Array(ev.data as any));

          // Handle relay meta messages
          try {
            const msg = JSON.parse(text);
            if (msg.type === "meta" && typeof msg.data === "string") {
              text = msg.data;
            }
          } catch {
            // Not JSON, use raw text
          }

          if (text.startsWith("coda:cwd:")) {
            const path = text.trim().slice("coda:cwd:".length);
            if (path) notifyRootSet(path);
            cleanup();
          } else if (text.startsWith("coda:error:")) {
            const msg = text.slice("coda:error:".length) || "Folder picker failed";
            toast.error(msg);
            cleanup();
          }
        };
        ws.onerror = () => { toast.error("Unable to contact runner for folder picker"); cleanup(); };
        ws.onclose = () => cleanup();
      });
    } finally {
      setPicking(false);
    }
  };

  const addSession = (mode: "terminal" | "agent") => {
    const n = sessions.length + 1;
    const label = mode === "agent" ? "Agent" : "Terminal";
    const s: Session = { id: crypto.randomUUID(), title: `${label} ${n}`, url: "", minimized: false, include: true, mode };
    const next = [...sessions, s];
    persist(next);
    setActiveId(s.id);
  };

  const closeSession = (id: string) => {
    const next = sessions.filter((s) => s.id !== id);
    persist(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const toggleMin = (id: string) => {
    const next = sessions.map((s) => (s.id === id ? { ...s, minimized: !s.minimized } : s));
    persist(next);
  };

  const rename = (id: string, title: string) => {
    const next = sessions.map((s) => (s.id === id ? { ...s, title } : s));
    persist(next);
  };

  const changeUrl = (id: string, url: string) => {
    const next = sessions.map((s) => (s.id === id ? { ...s, url } : s));
    persist(next);
  };

  const toggleInclude = (id: string) => {
    const next = sessions.map((s) => (s.id === id ? { ...s, include: !s.include } : s));
    persist(next);
  };

  const onOutput = (id: string, text: string) => {
    // Split into lines; keep the last 2000 entries
    const lines = text.replaceAll("\r\n", "\n").split("\n");
    const ts = Date.now();
    setCombined((prev) => {
      const add = lines.filter((l) => l.length > 0).map((l) => ({ ts, sessionId: id, text: l }));
      const next = [...prev, ...add];
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  };

  // Auto-follow combined logs
  useEffect(() => {
    if (!follow) return;
    const el = combinedRef;
    if (!el) return;
    // Microtask to scroll after render
    queueMicrotask(() => {
      try { el.scrollTop = el.scrollHeight; } catch {}
    });
  }, [combined, follow, combinedRef]);

  if (!isClient) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Terminals</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2 text-sm text-muted-foreground">
          <p>Loading terminal controls…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Terminals</span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => addSession("terminal")} className="gap-1" disabled={!projectRoot || online === false} title={!projectRoot ? "Pick a Project Root first" : online === false ? "Runner offline — Pair/Start it first" : undefined}>
              <Plus className="h-4 w-4" /> Terminal
            </Button>
            <Button size="sm" onClick={() => addSession("agent")} className="gap-1" disabled={!projectRoot || online === false} title={!projectRoot ? "Pick a Project Root first" : online === false ? "Runner offline — Pair/Start it first" : undefined}>
              <Plus className="h-4 w-4" /> Agent
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {noRunner || online === false ? (
          <div className="rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
            Runner offline. Pair this device and start the Runner.
            <button
              className="ml-2 underline"
              onClick={() => {
                try { window.location.href = "/dashboard/devmode/pair"; } catch {}
              }}
            >
              Pair Runner
            </button>
          </div>
        ) : null}
        {/* Project Root + Combined Logs Controls */}
        <div className="flex flex-col gap-2 rounded border p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Root</div>
            <div className="flex items-center gap-2">
              <Input
                value={projectRoot}
                onChange={(e) => persistProjectRoot(e.target.value)}
                placeholder="/path/on/runner (used for new connections)"
                className="h-8 w-[32rem] max-w-full"
              />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const fn = activeId ? pickersRef.current[activeId] : undefined;
              if (fn) {
                fn();
              } else {
                void pickFolderNoTerminal();
              }
            }}
            disabled={picking}
            title="Opens a native folder picker on the runner"
          >
            {picking ? "Picking…" : "Pick Folder…"}
          </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agent Session ID</div>
            <div className="flex items-center gap-2">
              <Input
                value={codexSession}
                onChange={(e) => persistCodexSession(e.target.value)}
                placeholder="optional: e.g., sess_123... (auto-exported on connect)"
                className="h-8 w-[32rem] max-w-full"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(codexSession)}
                disabled={!codexSession}
              >
                Copy
              </Button>
            </div>
          </div>
        </div>

        {/* Combined Logs Controls */}
        {sessions.length > 0 ? (
          <div className="rounded border p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Combined Logs</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-primary" />
                  Follow
                </label>
                <Button variant="secondary" size="sm" onClick={() => setCombined([])}>Clear</Button>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap gap-3">
              {sessions.map((s) => (
                <label key={s.id} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={s.include} onChange={() => toggleInclude(s.id)} className="accent-primary" />
                  <span className="rounded bg-muted px-1.5 py-0.5">{s.title || "Terminal"}</span>
                </label>
              ))}
            </div>
            <div
              ref={(el) => setCombinedRef(el)}
              onScroll={() => {
                // Disable follow when user scrolls up
                const el = combinedRef as unknown as HTMLDivElement | null;
                if (!el) return;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
                if (!atBottom && follow) setFollow(false);
              }}
              className="h-40 overflow-auto rounded border bg-black p-2 font-mono text-xs text-green-300"
              style={{ overscrollBehavior: "contain" }}
            >
              {combined
                .filter((l) => sessions.find((s) => s.id === l.sessionId)?.include)
                .map((l, i) => {
                  const title = sessions.find((s) => s.id === l.sessionId)?.title || "Terminal";
                  return (
                    <div key={i}>
                      <span className="text-blue-300">[{title}]</span> {l.text}
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}
        {/* Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex items-center gap-1 rounded border px-2 py-1 text-sm cursor-pointer ${
                activeId === s.id ? "border-blue-500 bg-blue-500/10" : "border-border hover:bg-muted"
              }`}
              role="button"
            >
              <Input
                value={s.title}
                onChange={(e) => rename(s.id, e.target.value)}
                className="h-7 w-40 border-none bg-transparent px-1 text-sm focus-visible:ring-0"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMin(s.id);
                }}
                title={s.minimized ? "Restore" : "Minimize"}
                className="rounded p-1 hover:bg-black/10 cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(s.id);
                }}
                title="Close"
                className="rounded p-1 hover:bg-black/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No terminals yet. Click “New Terminal”.</div>
          ) : null}
        </div>

        {/* Render all terminals to keep connections alive; show one at a time */}
        {sessions.length > 0 ? (
          <div className="relative">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={activeId === s.id && !s.minimized ? "block" : "hidden"}
              >
                {s.minimized ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    {s.title} is minimized. Click its tab to restore.
                  </div>
                ) : (
                  <TerminalPane
                    runnerId={runnerId}
                    initialUrl={s.url}
                    onUrlChange={(url) => changeUrl(s.id, url)}
                    visible={activeId === s.id}
                    onOutput={(text) => onOutput(s.id, text)}
                    ideaId={ideaId}
                    projectRoot={projectRoot || null}
                    codexSessionId={codexSession || null}
                    onProjectRootDetected={(path) => notifyRootSet(path)}
                    onRegisterPicker={(fn) => { pickersRef.current[s.id] = fn; }}
                    requireProjectRoot={true}
                    autoAgent={s.mode === "agent"}
                    onCodexSessionDetected={(sid) => persistCodexSession(sid)}
                    autoConnect={true}
                    onNoRunner={() => setNoRunner(true)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
