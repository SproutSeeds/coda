"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TerminalDock } from "./TerminalDock";
import { RecordingsList } from "./RecordingsList";
import { DevModeUsageWidget } from "./DevModeUsageWidget";

export function IdeaDevPanel({ ideaId, onRequestClose }: { ideaId: string; onRequestClose?: () => void }) {
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [paired, setPaired] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Preload a runner id (for default terminal URL)
  useEffect(() => {
    (async () => {
      try {
        // Optional runner list (may 404 if not implemented); ignore errors
        try {
          const res = await fetch("/api/devmode/runners");
          if (res.ok) {
            const data = await res.json();
            const first = data?.runners?.[0]?.id as string | undefined;
            if (first) setRunnerId((v) => v || first);
          }
        } catch {}
        // Pairing status (auth required)
        const s = await fetch("/api/devmode/pair/status", { cache: "no-store" as RequestCache });
        if (s.ok) {
          const j = await s.json();
          setPaired(!!j.paired);
        } else {
          setPaired(false);
        }
      } catch {}
    })();
  }, []);

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader>
        <CardTitle className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Dev Mode</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? "Expand" : "Minimize"}
            </Button>
            {onRequestClose ? (
              <Button size="sm" variant="ghost" onClick={onRequestClose}>Hide</Button>
            ) : null}
          </div>
        </CardTitle>
      </CardHeader>
      {!collapsed ? (
        <CardContent className="space-y-4">
          {paired === false ? (
            <div className="rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
              No paired Runner found for your account. Start the Runner and pair it here.
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
          <DevModeUsageWidget />
          <TerminalDock ideaId={ideaId} runnerId={runnerId} />
          <RecordingsList ideaId={ideaId} />
        </CardContent>
      ) : null}
    </Card>
  );
}
