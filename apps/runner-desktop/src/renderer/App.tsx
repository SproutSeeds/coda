import { useEffect, useMemo, useState } from "react";
import { Play, StopCircle, Globe, Radio, Settings2, Terminal, ExternalLink, RefreshCcw, Copy, Check, Hash, ChevronDown, ChevronUp, Filter, Trash2 } from "lucide-react";
import { Button } from "@ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/card";
import { Input } from "@ui/input";
import { Label } from "@ui/label";
import { Separator } from "@ui/separator";
import { cn } from "@/lib/utils";

type RunnerSettings = Awaited<ReturnType<typeof window.runner.getSettings>>;
type RunnerSnapshot = Awaited<ReturnType<typeof window.runner.getSnapshot>>;

type ThemeMode = "light" | "dark";

const statusCopy: Record<string, { label: string; tone: "success" | "warning" | "danger" | "muted" | "info" }> = {
  initializing: { label: "Starting…", tone: "info" },
  pairing: { label: "Pairing Required", tone: "warning" },
  online: { label: "Online", tone: "success" },
  stopped: { label: "Stopped", tone: "muted" },
  error: { label: "Error", tone: "danger" },
};

function toneClass(tone: "success" | "warning" | "danger" | "muted" | "info") {
  switch (tone) {
    case "success":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "danger":
      return "bg-destructive/15 text-destructive";
    case "info":
      return "bg-primary/15 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function useTheme(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  useEffect(() => {
    const body = document.body;
    if (mode === "dark") {
      body.classList.add("dark");
    } else {
      body.classList.remove("dark");
    }
  }, [mode]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setMode(event.matches ? "dark" : "light");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return [mode, setMode];
}

export default function App() {
  const [settings, setSettings] = useState<RunnerSettings | null>(null);
  const [snapshot, setSnapshot] = useState<RunnerSnapshot | null>(null);
  const [pendingSettings, setPendingSettings] = useState<RunnerSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const [copied, setCopied] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [logsMinimized, setLogsMinimized] = useState(false);
  const [allLogsCopied, setAllLogsCopied] = useState(false);
  const [tmuxSessions, setTmuxSessions] = useState<Array<{ name: string; created: number; attached: boolean }>>([]);
  const [isLoadingTmux, setIsLoadingTmux] = useState(false);
  const [expandedIdeas, setExpandedIdeas] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function bootstrap() {
      const [initialSettings, initialSnapshot] = await Promise.all([window.runner.getSettings(), window.runner.getSnapshot()]);
      setSettings(initialSettings);
      setPendingSettings(initialSettings);
      setSnapshot(initialSnapshot);
    }
    bootstrap().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });

    const unsubStatus = window.runner.onStatus((status) => {
      console.log("[Renderer] Received status update:", status);
      setSnapshot((prev) => {
        if (!prev) return { status, logs: [], pairingCode: null, activeSessions: [] };
        return { ...prev, status };
      });
    });
    const unsubLog = window.runner.onLog((entry) =>
      setSnapshot((prev) => {
        if (!prev) return { status: "stopped", logs: [entry], pairingCode: null, activeSessions: [] };
        return { ...prev, logs: [...prev.logs, entry].slice(-200) };
      }),
    );
    const unsubPair = window.runner.onPairingCode((payload) =>
      setSnapshot((prev) => {
        setCopied(false);
        if (!prev) return { status: "pairing", logs: [], pairingCode: payload, activeSessions: [] };
        return { ...prev, pairingCode: payload, status: "pairing" };
      }),
    );
    const unsubPairSuccess = window.runner.onPairingSuccess(() =>
      setSnapshot((prev) => {
        if (!prev) return prev;
        // Keep the pairing code visible even after success so it's always copyable
        return { ...prev };
      }),
    );
    const unsubError = window.runner.onError((message) => setError(message));

    // Poll for active sessions every 3 seconds
    const intervalId = setInterval(async () => {
      try {
        const freshSnapshot = await window.runner.getSnapshot();
        setSnapshot((prev) => prev ? { ...prev, activeSessions: freshSnapshot.activeSessions } : freshSnapshot);
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => {
      unsubStatus();
      unsubLog();
      unsubPair();
      unsubPairSuccess();
      unsubError();
      clearInterval(intervalId);
    };
  }, []);

  const statusInfo = useMemo(() => {
    if (!snapshot) return { label: "Loading…", tone: "info" as const };
    const base = statusCopy[snapshot.status] ?? { label: snapshot.status, tone: "info" as const };

    // Add connection count when online and there are active sessions
    if (snapshot.status === "online" && snapshot.activeSessions && snapshot.activeSessions.length > 0) {
      const count = snapshot.activeSessions.length;
      return {
        ...base,
        label: `${base.label} • ${count} terminal${count === 1 ? '' : 's'}`,
      };
    }

    return base;
  }, [snapshot]);

  async function handleSave(next: RunnerSettings) {
    setIsSaving(true);
    setError(null);
    try {
      await window.runner.saveSettings(next);
      setSettings(next);
      setPendingSettings(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStart() {
    console.log("[Renderer] handleStart called");
    setIsStarting(true);
    setError(null);
    try {
      if (pendingSettings && settings && JSON.stringify(pendingSettings) !== JSON.stringify(settings)) {
        console.log("[Renderer] Saving pending settings before start");
        await window.runner.saveSettings(pendingSettings);
        setSettings(pendingSettings);
      }
      console.log("[Renderer] Calling window.runner.start()");
      const next = await window.runner.start();
      console.log("[Renderer] window.runner.start() returned:", next);
      setSnapshot(next);
    } catch (err) {
      console.error("[Renderer] Error in handleStart:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      console.log("[Renderer] handleStart completed, isStarting = false");
      setIsStarting(false);
    }
  }

  async function handleStop() {
    setIsStarting(true);
    setError(null);
    try {
      const next = await window.runner.stop();
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStarting(false);
    }
  }

  function updateField<Key extends keyof RunnerSettings>(key: Key, value: RunnerSettings[Key]) {
    setPendingSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  }

  function hasDirtySettings() {
    if (!settings || !pendingSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(pendingSettings);
  }

  async function refreshTmuxSessions() {
    setIsLoadingTmux(true);
    try {
      const sessions = await window.runner.listTmuxSessions();
      setTmuxSessions(sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingTmux(false);
    }
  }

  async function killTmuxSession(sessionName: string) {
    try {
      const result = await window.runner.killTmuxSession(sessionName);
      if (result.success) {
        await refreshTmuxSessions();
      } else {
        setError(result.error || "Failed to kill session");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function killAllTmuxSessions() {
    try {
      const result = await window.runner.killAllTmuxSessions();
      if (result.success) {
        const count = (result as any).killedCount || 0;
        console.log(`Killed ${count} Coda tmux session(s)`);
        await refreshTmuxSessions();
      } else {
        setError(result.error || "Failed to kill Coda sessions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const pairingUrl = pendingSettings?.baseUrl?.replace(/\/$/, "") + "/dashboard/devmode/pair";

  useEffect(() => {
    setCopied(false);
  }, [snapshot?.pairingCode?.code]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 overflow-y-auto px-6 py-8">
      <div className="app-drag-bar" />
      <header className="app-drag select-none flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Coda TMUX Bridge</h1>
          <p className="text-muted-foreground">This helper is TMUX-only—pair once, then mirror your local TMUX session directly into codacli.com.</p>
        </div>
        <div className="app-no-drag flex items-center gap-2">
          <Button
            variant="ghost"
            className="interactive-btn app-no-drag"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      <main className="grid flex-1 grid-cols-1 gap-6 overflow-visible lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-6 overflow-y-auto pb-4">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5 text-primary" />
                Runner Configuration
              </CardTitle>
              <CardDescription>Confirm the endpoints this helper should use when connecting to Codex.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  App Base URL
                </Label>
                <Input
                  id="baseUrl"
                  placeholder="https://www.codacli.com"
                  value={pendingSettings?.baseUrl ?? ""}
                  onChange={(event) => updateField("baseUrl", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relayUrl" className="flex items-center gap-2">
                  <Radio className="size-4 text-muted-foreground" />
                  Relay URL
                </Label>
                <Input
                  id="relayUrl"
                  placeholder="wss://relay-falling-butterfly-779.fly.dev"
                  value={pendingSettings?.relayUrl ?? ""}
                  onChange={(event) => updateField("relayUrl", event.target.value)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="deviceId">Runner Device ID</Label>
                <Input
                  id="deviceId"
                  value={pendingSettings?.deviceId ?? ""}
                  onChange={(event) => updateField("deviceId", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deviceName">Runner Display Name</Label>
                <Input
                  id="deviceName"
                  value={pendingSettings?.deviceName ?? ""}
                  onChange={(event) => updateField("deviceName", event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={!hasDirtySettings() || isSaving || !pendingSettings}
                  onClick={() => pendingSettings && handleSave(pendingSettings)}
                >
                  <RefreshCcw className="size-4" />
                  {isSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    const [freshSettings, freshSnapshot] = await Promise.all([window.runner.getSettings(), window.runner.getSnapshot()]);
                    setSettings(freshSettings);
                    setPendingSettings(freshSettings);
                    setSnapshot(freshSnapshot);
                  }}
                >
                  Reset Form
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldIcon />
                Setup & Status
              </CardTitle>
              <CardDescription>Follow the steps below to connect your local terminals to Coda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step-by-step guide */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    1
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium">Start the runner</div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isStarting || snapshot?.status === "online"}
                        onClick={handleStart}
                      >
                        <Play className="size-4" />
                        {isStarting && snapshot?.status !== "online" ? "Starting…" : "Start Runner"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isStarting || snapshot?.status === "stopped"}
                        onClick={handleStop}
                      >
                        <StopCircle className="size-4" />
                        Stop
                      </Button>
                      <div className={cn("ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", toneClass(statusInfo.tone))}>
                        <span className="size-2 rounded-full bg-current" />
                        {statusInfo.label}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    2
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium">Open Coda in your browser</div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const url = pendingSettings?.baseUrl || "https://www.codacli.com";
                        window.runner.openPairPage(url);
                      }}
                    >
                      <ExternalLink className="size-4" />
                      Open codacli.com
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    3
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium">Pair this device</div>
                    {snapshot?.pairingCode ? (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          {snapshot.status === "online"
                            ? "✓ Device paired successfully!"
                            : "Copy this code and enter it in the browser:"}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-lg font-semibold tracking-wider">
                            {snapshot.pairingCode.code}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (snapshot.pairingCode?.code) {
                                await navigator.clipboard.writeText(snapshot.pairingCode.code);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              }
                            }}
                          >
                            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                            {copied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                        {snapshot.status !== "online" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => pairingUrl && window.runner.openPairPage(pairingUrl)}
                          >
                            Open Pairing Page
                            <ExternalLink className="size-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {snapshot?.status === "online"
                          ? "✓ Device is already paired"
                          : "Start the runner to generate a pairing code"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-md border border-muted/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                Resetting pairing will:
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Clear the stored relay token</li>
                  <li>Disconnect all active web terminals</li>
                  <li>Require re-pairing in the web app</li>
                  <li>Keep local tmux sessions alive</li>
                </ul>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={async () => {
                  const activeCount = snapshot?.activeSessions?.length ?? 0;
                  const confirmMessage = activeCount > 0
                    ? `Reset pairing and disconnect ${activeCount} active terminal${activeCount === 1 ? '' : 's'}? You'll need to re-pair the runner in the web app.`
                    : "Reset pairing? You'll need to re-pair the runner in the web app.";

                  if (confirm(confirmMessage)) {
                    await window.runner.clearToken();
                    const freshSnapshot = await window.runner.getSnapshot();
                    setSnapshot(freshSnapshot);
                    setCopied(false);
                  }
                }}
              >
                Reset Pairing & Disconnect
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-5 text-primary" />
                Paired Devices
              </CardTitle>
              <CardDescription>Manage paired runners in your browser</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const devicesUrl = pendingSettings?.baseUrl?.replace(/\/$/, "") + "/dashboard/devmode/devices";
                  if (devicesUrl) {
                    window.runner.openPairPage(devicesUrl);
                  }
                }}
              >
                <ExternalLink className="size-4" />
                View & Revoke Paired Devices
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Terminal className="size-5 text-primary" />
                Active Terminal Connections
              </CardTitle>
              <CardDescription>Sessions currently connected to this runner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot?.activeSessions && snapshot.activeSessions.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    const count = snapshot.activeSessions?.length ?? 0;
                    if (confirm(`Disconnect ${count} active terminal${count === 1 ? '' : 's'}? This will close all web terminal connections but keep tmux sessions alive.`)) {
                      try {
                        await window.runner.stop();
                        await window.runner.start();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      }
                    }
                  }}
                >
                  <Terminal className="size-4" />
                  Disconnect All Terminals
                </Button>
              )}
              {snapshot?.activeSessions && snapshot.activeSessions.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    // Group sessions by ideaId
                    const grouped = new Map<string, typeof snapshot.activeSessions>();
                    const ungrouped: typeof snapshot.activeSessions = [];

                    snapshot.activeSessions.forEach((session) => {
                      if (!session.sessionName) {
                        ungrouped.push(session);
                        return;
                      }

                      const parts = session.sessionName.split('-');
                      if (parts.length >= 5) {
                        const ideaId = parts[parts.length - 2];
                        if (!grouped.has(ideaId)) {
                          grouped.set(ideaId, []);
                        }
                        grouped.get(ideaId)!.push(session);
                      } else {
                        ungrouped.push(session);
                      }
                    });

                    return (
                      <>
                        {/* Grouped by idea */}
                        {Array.from(grouped.entries()).map(([ideaId, sessions]) => {
                          const isExpanded = expandedIdeas.has(ideaId);
                          return (
                            <div key={ideaId} className="space-y-1">
                              {/* Idea header */}
                              <Button
                                variant="ghost"
                                className="w-full justify-start gap-2 px-3 py-2 h-auto text-left hover:bg-muted/50"
                                onClick={() => {
                                  setExpandedIdeas((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(ideaId)) {
                                      next.delete(ideaId);
                                    } else {
                                      next.add(ideaId);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {isExpanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronUp className="size-4 shrink-0" />}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                                    <code className="text-sm font-medium">Idea: {ideaId}</code>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {sessions.length} slot{sessions.length === 1 ? '' : 's'}
                                  </div>
                                </div>
                              </Button>

                              {/* Slot sessions */}
                              {isExpanded && (
                                <div className="ml-6 space-y-1 border-l-2 border-border/30 pl-2">
                                  {sessions.map((session) => {
                                    const attachCommand = session.sessionName ? `tmux attach -t ${session.sessionName}` : null;
                                    const parts = session.sessionName?.split('-') || [];
                                    const slotId = parts[parts.length - 1];

                                    return (
                                      <div
                                        key={session.sessionId}
                                        className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                                      >
                                        <div className="flex-1 space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="size-2 rounded-full bg-emerald-500" />
                                            <code className="text-xs font-medium">Slot: {slotId}</code>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {session.pid ? `PID: ${session.pid}` : "No PID"} • Connected {new Date(session.connectedAt).toLocaleTimeString()}
                                          </div>
                                        </div>
                                        {attachCommand && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="app-no-drag size-7 shrink-0"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(attachCommand);
                                                setCopiedSessionId(session.sessionId);
                                                setTimeout(() => setCopiedSessionId(null), 1500);
                                              } catch {
                                                // ignore
                                              }
                                            }}
                                            title={`Copy: ${attachCommand}`}
                                          >
                                            {copiedSessionId === session.sessionId ? (
                                              <Check className="size-3 text-emerald-500" />
                                            ) : (
                                              <Copy className="size-3" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Ungrouped sessions */}
                        {ungrouped.map((session) => {
                          const attachCommand = session.sessionName ? `tmux attach -t ${session.sessionName}` : null;
                          return (
                            <div
                              key={session.sessionId}
                              className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-4 py-3"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="size-2 rounded-full bg-emerald-500" />
                                  <code className="text-sm font-medium">{session.sessionName || session.sessionId.slice(0, 8)}</code>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {session.pid ? `PID: ${session.pid}` : "No PID"} • Connected {new Date(session.connectedAt).toLocaleTimeString()}
                                </div>
                              </div>
                              {attachCommand && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="app-no-drag size-8 shrink-0"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(attachCommand);
                                      setCopiedSessionId(session.sessionId);
                                      setTimeout(() => setCopiedSessionId(null), 1500);
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  title={`Copy: ${attachCommand}`}
                                >
                                  {copiedSessionId === session.sessionId ? (
                                    <Check className="size-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  No active terminal connections. Open a terminal in the web app to see connections here.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Terminal className="size-5 text-primary" />
                TMUX Session Management
              </CardTitle>
              <CardDescription>View and manage all TMUX sessions on this machine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={refreshTmuxSessions}
                  disabled={isLoadingTmux}
                  className="flex-1"
                >
                  <RefreshCcw className={cn("size-4", isLoadingTmux && "animate-spin")} />
                  {isLoadingTmux ? "Loading..." : "Refresh Sessions"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Kill all Coda-related tmux sessions? This will only affect sessions starting with 'coda-runner-' or 'coda-'. Your other tmux sessions will not be affected.")) {
                      killAllTmuxSessions();
                    }
                  }}
                  disabled={tmuxSessions.length === 0}
                  className="flex-1"
                >
                  <Trash2 className="size-4" />
                  Kill All Coda Sessions
                </Button>
              </div>

              {tmuxSessions.length > 0 ? (
                <div className="space-y-2">
                  {tmuxSessions.map((session) => (
                    <div
                      key={session.name}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-4 py-3"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", session.attached ? "bg-emerald-500" : "bg-muted-foreground")} />
                          <code className="text-sm font-medium">{session.name}</code>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(session.created).toLocaleString()} • {session.attached ? "Attached" : "Detached"}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="app-no-drag size-8 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Kill session "${session.name}"?`)) {
                            killTmuxSession(session.name);
                          }
                        }}
                        title={`Kill session: ${session.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  {isLoadingTmux ? "Loading sessions..." : "No TMUX sessions found. Click 'Refresh Sessions' to check."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className={cn("flex flex-col overflow-hidden transition-all", logsMinimized ? "h-auto" : "h-full")}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-card/80">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="size-5 text-primary" />
                  Runner Activity
                </CardTitle>
                {!logsMinimized && <CardDescription>The most recent entries appear at the bottom.</CardDescription>}
              </div>
              {!logsMinimized && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="app-no-drag size-8"
                  onClick={async () => {
                    const logs = snapshot?.logs ?? [];
                    if (logs.length === 0) return;

                    const allLogsText = logs
                      .map((entry) => {
                        const timestamp = new Date(entry.timestamp).toLocaleString();
                        const context = entry.context ? `\n${JSON.stringify(entry.context, null, 2)}` : '';
                        return `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${context}`;
                      })
                      .join('\n\n');

                    try {
                      await navigator.clipboard.writeText(allLogsText);
                      setAllLogsCopied(true);
                      setTimeout(() => setAllLogsCopied(false), 1500);
                    } catch {
                      // ignore
                    }
                  }}
                  title="Copy all logs"
                >
                  {allLogsCopied ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSnapshot((prev) => prev ? { ...prev, logs: [] } : prev);
                }}
                title="Clear logs"
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const nextSnapshot = await window.runner.getSnapshot();
                  setSnapshot(nextSnapshot);
                }}
              >
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLogsMinimized(!logsMinimized)}
                className="app-no-drag"
              >
                {logsMinimized ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              </Button>
            </div>
          </CardHeader>
          {!logsMinimized && (
            <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
              <LogViewer logs={snapshot?.logs ?? []} />
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}

function LogViewer({ logs }: { logs: Array<RunnerSnapshot["logs"][number]> }) {
  const [filterLevel, setFilterLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const filteredLogs = useMemo(() => {
    if (filterLevel === "all") return logs;
    return logs.filter(log => log.level === filterLevel);
  }, [logs, filterLevel]);

  const copyLog = async (entry: RunnerSnapshot["logs"][number], index: number) => {
    const text = entry.context
      ? `[${entry.level.toUpperCase()}] ${entry.message}\n${JSON.stringify(entry.context, null, 2)}`
      : `[${entry.level.toUpperCase()}] ${entry.message}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // ignore
    }
  };

  if (!logs.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Runner logs will stream in once sessions connect.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2">
        <Filter className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>
        <div className="flex gap-1">
          {(["all", "info", "warn", "error"] as const).map((level) => (
            <Button
              key={level}
              variant={filterLevel === level ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterLevel(level)}
              className="h-6 px-2 text-xs"
            >
              {level === "all" ? "All" : level}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredLogs.length} {filteredLogs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Log list */}
      <div className="scrollbar-thin flex-1 overflow-auto bg-card px-4 py-4 text-sm">
        <ul className="space-y-2">
          {filteredLogs.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`} className="group rounded-md border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", toneClass(levelTone(entry.level)))}>
                    {entry.level}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => copyLog(entry, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </div>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-foreground">{entry.message}</pre>
              {entry.context ? (
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                  {JSON.stringify(entry.context, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function levelTone(level: RunnerSnapshot["logs"][number]["level"]): "success" | "warning" | "danger" | "muted" | "info" {
  switch (level) {
    case "error":
      return "danger";
    case "warn":
      return "warning";
    case "info":
    default:
      return "muted";
  }
}

function ShieldIcon() {
  return (
    <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
