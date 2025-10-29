import { useEffect, useMemo, useState } from "react";
import { Play, StopCircle, Globe, Radio, Settings2, Terminal, ExternalLink, RefreshCcw, Copy, Check, Hash } from "lucide-react";
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
  const [initCopied, setInitCopied] = useState(false);
  const [tmuxCopied, setTmuxCopied] = useState(false);
  const [ideaId, setIdeaId] = useState("");
  const [sessionSlot, setSessionSlot] = useState("primary");

  useEffect(() => {
    try {
      const storedIdea = window.localStorage.getItem("tmux.ideaId");
      if (storedIdea) setIdeaId(storedIdea);
      const storedSlot = window.localStorage.getItem("tmux.sessionSlot");
      if (storedSlot) setSessionSlot(storedSlot);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("tmux.ideaId", ideaId);
    } catch {
      /* ignore */
    }
  }, [ideaId]);

  useEffect(() => {
    try {
      window.localStorage.setItem("tmux.sessionSlot", sessionSlot);
    } catch {
      /* ignore */
    }
  }, [sessionSlot]);

  useEffect(() => {
    async function bootstrap() {
      const [initialSettings, initialSnapshot] = await Promise.all([window.runner.getSettings(), window.runner.getSnapshot()]);
      setSettings(initialSettings);
      setPendingSettings(initialSettings);
      setIdeaId(initialSettings.ideaId ?? "");
      setSessionSlot(initialSettings.sessionSlot ?? "primary");
      setSnapshot(initialSnapshot);
    }
    bootstrap().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });

    const unsubStatus = window.runner.onStatus((status) =>
      setSnapshot((prev) => {
        if (!prev) return { status, logs: [], pairingCode: null, activeSessions: [] };
        return { ...prev, status };
      }),
    );
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
        return { ...prev, pairingCode: null };
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
    return statusCopy[snapshot.status] ?? { label: snapshot.status, tone: "info" as const };
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
    setIsStarting(true);
    setError(null);
    try {
      if (pendingSettings && settings && JSON.stringify(pendingSettings) !== JSON.stringify(settings)) {
        await window.runner.saveSettings(pendingSettings);
        setSettings(pendingSettings);
      }
      const next = await window.runner.start();
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
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

  function handleIdeaChange(value: string) {
    setIdeaId(value);
    setPendingSettings((prev) => (prev ? { ...prev, ideaId: value } : prev));
  }

  function handleSlotChange(value: string) {
    setSessionSlot(value);
    setPendingSettings((prev) => (prev ? { ...prev, sessionSlot: value } : prev));
  }

  const pairingUrl = pendingSettings?.baseUrl?.replace(/\/$/, "") + "/dashboard/devmode/pair";

  const latestTmuxSession = useMemo(() => {
    const entries = snapshot?.logs ?? [];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const message = entries[i]?.message ?? "";
      if (typeof message === "string" && message.startsWith("TTY tmux session ")) {
        const session = message.slice("TTY tmux session ".length).trim();
        if (session) return session;
      }
    }
    return null;
  }, [snapshot?.logs]);

  const rawIdea = ideaId.trim();
  const rawSlot = sessionSlot.trim();
  const ideaSlug = rawIdea ? rawIdea.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : "workspace";
  const slotSlug = rawSlot ? rawSlot.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : "primary";
  const sessionName = `coda-${ideaSlug}-${slotSlug}`;
  const effectiveSession = latestTmuxSession ?? sessionName;
  const initCommand = `tmux new-session -A -s ${sessionName}`;
  const attachCommand = `tmux attach -t ${effectiveSession}`;
  const ideaSlugDiffers = Boolean(rawIdea && ideaSlug !== rawIdea);
  const slotSlugDiffers = Boolean(rawSlot && slotSlug !== rawSlot);
  const hasOverrideSession = Boolean(latestTmuxSession && latestTmuxSession !== sessionName);

  useEffect(() => {
    setCopied(false);
  }, [snapshot?.pairingCode?.code]);

  useEffect(() => {
    setInitCopied(false);
    setTmuxCopied(false);
  }, [initCommand, attachCommand]);

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
                    setIdeaId(freshSettings.ideaId ?? "");
                    setSessionSlot(freshSettings.sessionSlot ?? "primary");
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
                Pairing & Status
              </CardTitle>
              <CardDescription>Generate pairing codes, approve this device, and monitor connection state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/80 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Current status</div>
                  <div className={cn("mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", toneClass(statusInfo.tone))}>
                    <span className="size-2 rounded-full bg-current" />
                    {statusInfo.label}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="default" disabled={isStarting || snapshot?.status === "online"} onClick={handleStart}>
                    <Play className="size-4" />
                    {isStarting && snapshot?.status !== "online" ? "Starting…" : "Start"}
                  </Button>
                  <Button variant="outline" disabled={isStarting || snapshot?.status === "stopped"} onClick={handleStop}>
                    <StopCircle className="size-4" />
                    Stop
                  </Button>
                </div>
              </div>

              {snapshot?.pairingCode ? (
                <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
                    Enter this code on the Dev Mode → Pair page
                    <Button
                      variant="ghost"
                      size="icon"
                      className="app-no-drag size-7"
                      onClick={async () => {
                        if (snapshot.pairingCode?.code) {
                          await navigator.clipboard.writeText(snapshot.pairingCode.code);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }
                      }}
                      aria-label="Copy pairing code"
                    >
                      {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-[0.65rem] text-primary-foreground">{snapshot.pairingCode.code}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Expires at {snapshot.pairingCode.expiresAt.toLocaleString?.() ?? snapshot.pairingCode.expiresAt.toString()}
                  </div>
                  <Button className="mt-4" variant="ghost" onClick={() => pairingUrl && window.runner.openPairPage(pairingUrl)}>
                    Open Pairing Page
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  Pairing codes will surface here whenever the runner needs approval.
                </div>
              )}

              <div className="rounded-md border border-muted/60 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                Resetting pairing clears the stored relay token. Use this if you need to move the runner to a new environment.
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  await window.runner.clearToken();
                  const freshSnapshot = await window.runner.getSnapshot();
                  setSnapshot(freshSnapshot);
                  setCopied(false);
                }}
              >
                Reset pairing
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-5 text-primary" />
            TMUX Session Control
          </CardTitle>
          <CardDescription>This helper only works with TMUX—wrap the shell you already use, then reconnect anywhere.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ideaId" className="flex items-center gap-2">
                    <Hash className="size-4 text-muted-foreground" />
                    Idea or Workspace ID
                  </Label>
                  <Input
                    id="ideaId"
                    placeholder="e.g. 001-build-a-lightweight"
                    value={ideaId}
                    onChange={(event) => handleIdeaChange(event.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionSlot">Session slot (optional)</Label>
                  <Input
                    id="sessionSlot"
                    placeholder="primary"
                    value={sessionSlot}
                    onChange={(event) => handleSlotChange(event.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>

              {ideaSlugDiffers || slotSlugDiffers ? (
                <p className="text-xs text-muted-foreground">
                  Session names are sanitized for TMUX compatibility: <code>{sessionName}</code>.
                </p>
              ) : null}

              <div className="space-y-3">
                <div className="rounded-md border border-border/70 bg-card/60 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Initialize session (run once)</div>
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-dashed border-border/60 bg-background/80 px-3 py-2 font-mono text-sm text-foreground">
                    <span className="truncate">{initCommand}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="app-no-drag size-8"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(initCommand);
                          setInitCopied(true);
                          setTimeout(() => setInitCopied(false), 1500);
                        } catch {
                          setInitCopied(false);
                        }
                      }}
                      aria-label="Copy tmux init command"
                    >
                      {initCopied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Run this inside your existing local terminal to wrap your active shell in TMUX. The <code>-A</code> flag creates the session if needed and reattaches when it already exists.
                  </div>
                </div>

                <div className="rounded-md border border-border/70 bg-card/60 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reattach session</div>
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-dashed border-border/60 bg-background/80 px-3 py-2 font-mono text-sm text-foreground">
                    <span className="truncate">{attachCommand}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="app-no-drag size-8"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(attachCommand);
                          setTmuxCopied(true);
                          setTimeout(() => setTmuxCopied(false), 1500);
                        } catch {
                          setTmuxCopied(false);
                        }
                      }}
                      aria-label="Copy tmux attach command"
                    >
                      {tmuxCopied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                  {hasOverrideSession ? (
                    <div className="mt-2 text-xs text-primary">
                      Live session detected: <code>{latestTmuxSession}</code>. The attach command reflects the active relay session.
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Update the idea or slot above to generate a deterministic session name. The helper defaults to <code>{sessionName}</code>.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-muted-foreground/40 bg-muted/15 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Session lifecycle</p>
                <ol className="mt-2 space-y-2 list-decimal pl-4">
                  <li>
                    Run the initialize command inside the terminal you want mirrored. From that moment on, every command in that pane lives inside TMUX.
                  </li>
                  <li>
                    With the helper paired, open the idea in codacli.com → Dev Mode → Terminals. The browser attaches to the same TMUX session and stays in lockstep.
                  </li>
                  <li>
                    Detach locally with <code>Ctrl+B</code> then <code>D</code>. To resume on your rig, run the reattach command; reopening the idea in the web app attaches automatically.
                  </li>
                </ol>
              </div>

              <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-xs text-primary">
                <p className="font-medium">Pro tip</p>
                <p className="mt-1">
                  Want a dedicated TMUX window per idea? Launch <code>tmux new-window -t {sessionName}</code> after initialising, then split panes as usual—both the browser and your local terminal will reflect every change instantly.
                </p>
              </div>
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
              {snapshot?.activeSessions && snapshot.activeSessions.length > 0 ? (
                <div className="space-y-2">
                  {snapshot.activeSessions.map((session) => (
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  No active terminal connections. Open a terminal in the web app to see connections here.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="flex h-full flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-card/80">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="size-5 text-primary" />
                Runner Activity
              </CardTitle>
              <CardDescription>The most recent entries appear at the bottom.</CardDescription>
            </div>
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
          </CardHeader>
          <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
            <LogViewer logs={snapshot?.logs ?? []} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function LogViewer({ logs }: { logs: Array<RunnerSnapshot["logs"][number]> }) {
  if (!logs.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Runner logs will stream in once sessions connect.
      </div>
    );
  }
  return (
    <div className="scrollbar-thin flex-1 overflow-auto bg-card px-4 py-4 text-sm">
      <ul className="space-y-2">
        {logs.map((entry, index) => (
          <li key={`${entry.timestamp}-${index}`} className="rounded-md border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", toneClass(levelTone(entry.level)))}>
                {entry.level}
              </span>
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
