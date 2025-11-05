"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gauge, Server } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type DevModeUsagePayload = {
  last30DaysMinutes: number;
  monthToDateMinutes: number;
  totalSessions: number;
  lastSessionAt: string | null;
  lastSessionDurationMinutes: number;
  billedTo: "personal" | "workspace";
  minuteCostUsd: number;
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
});

export function DevModeUsageWidget() {
  const [usage, setUsage] = useState<DevModeUsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/devmode/usage", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Unable to load Dev Mode usage");
        }
        const data = (await res.json()) as DevModeUsagePayload;
        if (!cancelled) {
          setUsage(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load Dev Mode usage");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="size-4 text-amber-200" />
          <CardTitle className="text-sm font-semibold text-amber-100">Dev Mode usage unavailable</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-amber-100/90">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return (
      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground">Loading Dev Mode usage…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gauge className="size-4" /> Dev Mode minutes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Charged to {usage.billedTo === "workspace" ? "your workspace" : "your personal credits"}. Current rate ~{currencyFormatter.format(usage.minuteCostUsd)} per minute.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-foreground/90">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground uppercase">Last 30 days</div>
            <div className="text-lg font-semibold text-foreground">
              {numberFormatter.format(usage.last30DaysMinutes)} minutes
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground uppercase">This month</div>
            <div className="text-lg font-semibold text-foreground">
              {numberFormatter.format(usage.monthToDateMinutes)} minutes
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Total sessions</span>
            <span className="font-medium text-foreground">{usage.totalSessions}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last session</span>
            <span className="font-medium text-foreground">
              {usage.lastSessionAt ? new Date(usage.lastSessionAt).toLocaleString() : "–"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last session duration</span>
            <span className="font-medium text-foreground">
              {numberFormatter.format(usage.lastSessionDurationMinutes)} minutes
            </span>
          </div>
        </div>
        <Separator />
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Server className="mt-0.5 size-4 text-muted-foreground/80" />
          <p>
            Keep your Runner online to avoid reconnecting. When you’re close to plan limits, we’ll pause Dev Mode sessions before charging overages.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
