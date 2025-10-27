"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, Info, Link, TerminalSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type PlatformKey = "mac-arm64";

type Installer = {
  key: PlatformKey;
  label: string;
  href: string | null;
  notes: string;
  status?: "available" | "coming-soon";
  secondary?: string;
};

const DOWNLOAD_LABELS: Record<PlatformKey, string> = {
  "mac-arm64": "macOS (Apple Silicon) – .dmg",
};

const DETECTORS: Array<{ test: (ua: string) => boolean; key: PlatformKey }> = [
  { test: (ua) => /Macintosh;.*Apple M/.test(ua), key: "mac-arm64" },
];

export default function DownloadsPage() {
  const base = process.env.NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE || "";
  const relayUrl = process.env.NEXT_PUBLIC_DEVMODE_RELAY_URL || "";
  const appBase = process.env.NEXT_PUBLIC_SITE_URL || "";

  const installers: Installer[] = useMemo(() => {
    const safe = (path: string) => (base ? `${base}/${path}` : null);
    return [
      {
        key: "mac-arm64",
        label: DOWNLOAD_LABELS["mac-arm64"],
        href: safe("coda-runner-companion-mac-arm64.dmg"),
        notes: "Built for Apple Silicon (M-series) Macs. Drag the app to Applications and launch to pair.",
        status: safe("coda-runner-companion-mac-arm64.dmg") ? "available" : "coming-soon",
      },
    ];
  }, [base]);

  const [platform, setPlatform] = useState<PlatformKey | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    const detected = DETECTORS.find(({ test }) => test(ua));
    if (detected) setPlatform(detected.key);
  }, []);

  const prioritizedInstallers = installers;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">Coda Runner Companion</CardTitle>
          <CardDescription>
            Download the desktop companion to pair once, auto-reconnect, and launch terminals in seconds. The app wraps the new runner-core module and ships with our full theme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          {!base ? (
            <EnvironmentHint icon={<Info className="size-4" />}>
              Set <code>NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE</code> to the release folder that contains your installers (for example, a GitHub releases
              URL). The cards below will update automatically.
            </EnvironmentHint>
          ) : null}
          <EnvironmentHint icon={<TerminalSquare className="size-4" />}>
            Apple Silicon is fully supported. If you prefer to skip the companion, scroll down for the tmux-ready CLI commands&mdash;they pair with the same relay flow.
          </EnvironmentHint>
          <div className="grid gap-4">
            {prioritizedInstallers.map((installer) => (
              <InstallerCard
                key={installer.key}
                installer={installer}
                highlighted={platform === installer.key}
              />
            ))}
          </div>
          <Separator />
          <div className="rounded-lg border border-muted/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <ul className="space-y-3">
              <li className="flex gap-2">
                <ArrowRight className="mt-1 size-4 text-primary" />
                <span>
                  Launch the companion, confirm the Relay ({relayUrl || "set NEXT_PUBLIC_DEVMODE_RELAY_URL"}) and App Base ({appBase || "set NEXT_PUBLIC_SITE_URL"}) values, then click <em>Pair Runner</em>.
                </span>
              </li>
              <li className="flex gap-2">
                <ArrowRight className="mt-1 size-4 text-primary" />
                <span>The desktop wizard shows a short code. In the browser go to Dev Mode → Pair runner, enter the code once, and you&apos;re online.</span>
              </li>
              <li className="flex gap-2">
                <ArrowRight className="mt-1 size-4 text-primary" />
                <span>Open the Dev Mode drawer from any project to launch a terminal or view logs. The runner stays available in the background.</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TerminalSquare className="size-5 text-primary" />
            CLI runner (tmux ready)
          </CardTitle>
          <CardDescription>
            Skip the desktop companion and run the binary directly. Export the same relay settings and you&apos;ll stay attached to the tmux session announced in Dev Mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <EnvironmentHint icon={<Link className="size-4" />}>
            CLI builds live in the same release folder. The macOS binary is <code>coda-runner-macos-arm64</code>. Add <code>TTY_SYNC=tmux</code> to keep sessions mirrored.
          </EnvironmentHint>
          <LegacyCommands relayUrl={relayUrl} appBase={appBase} base={base} />
        </CardContent>
      </Card>
    </div>
  );
}

function InstallerCard({ installer, highlighted }: { installer: Installer; highlighted: boolean }) {
  return (
    <div
      className="rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm"
      data-highlighted={highlighted}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{installer.label}</div>
          <p className="mt-1 text-xs text-muted-foreground">{installer.notes}</p>
          {installer.secondary ? (
            <p className="mt-1 text-xs text-muted-foreground">{installer.secondary}</p>
          ) : null}
        </div>
        {installer.href ? (
          <Button asChild className="interactive-btn" size="sm">
            <a href={installer.href}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        ) : (
          <span className="rounded-full border border-dashed border-amber-500/50 bg-amber-100/60 px-3 py-1 text-[11px] font-semibold uppercase text-amber-700">
            {installer.status === "coming-soon" ? "Coming soon" : "Pending release URL"}
          </span>
        )}
      </div>
      {highlighted ? (
        <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
          Recommended for this device
        </div>
      ) : null}
    </div>
  );
}

function EnvironmentHint({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-400/50 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
      <span className="mt-0.5 text-amber-600">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function LegacyCommands({ relayUrl, appBase, base }: { relayUrl: string; appBase: string; base: string }) {
  const placeholderRelay = relayUrl || "wss://<your-relay-domain>";
  const placeholderBase = appBase || "https://<your-app-domain>";
  const binaryDisplay = base ? `${base}/coda-runner-macos-arm64` : "dist/coda-runner-macos-arm64";
  const binaryCommand = base ? "./coda-runner-macos-arm64" : "./dist/coda-runner-macos-arm64";
  const commandLines = [
    "TTY_SYNC=tmux \\",
    `RELAY_URL=${placeholderRelay} \\`,
    `BASE_URL=${placeholderBase} \\`,
    "DEV_RUNNER_ID=my-mac \\",
    binaryCommand,
  ];
  const command = commandLines.join("\n");
  return (
    <div className="grid gap-4">
      <LegacyCard
        title="macOS"
        binary={binaryDisplay}
        command={command}
        note="If macOS quarantines the binary, run: xattr -dr com.apple.quarantine ./coda-runner-macos-arm64. Once paired, copy the coda:session name from Dev Mode and attach locally with tmux attach -t <name>."
      />
    </div>
  );
}

function LegacyCard({
  title,
  binary,
  command,
  note,
}: {
  title: string;
  binary: string;
  command: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-4 text-xs">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-muted-foreground">
        Binary: <span className="font-mono">{binary}</span>
      </div>
      <div className="mt-2 font-semibold uppercase tracking-wide text-muted-foreground">Quick start</div>
      <pre className="mt-1 overflow-auto rounded bg-muted/70 p-3 text-[11px] leading-relaxed">{command}</pre>
      {note ? <p className="mt-2 text-muted-foreground">{note}</p> : null}
    </div>
  );
}
