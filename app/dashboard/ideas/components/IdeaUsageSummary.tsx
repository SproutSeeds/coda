"use client";

import { Sparkles, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsageMetricSummary } from "@/lib/limits/summary";

import type { JoinRequestCounts } from "./types";

type IdeaUsageSummaryProps = {
  planName: string;
  features: UsageMetricSummary;
  collaborators: UsageMetricSummary;
  joinRequests: JoinRequestCounts | null;
  canManageCollaborators: boolean;
};

const STATUS_COLORS: Record<UsageMetricSummary["status"], string> = {
  ok: "bg-primary",
  warn: "bg-amber-500",
  blocked: "bg-rose-500",
  unlimited: "bg-muted-foreground/40",
};

const STATUS_COPY: Record<UsageMetricSummary["status"], string> = {
  ok: "On track",
  warn: "Approaching limit",
  blocked: "Limit reached",
  unlimited: "Unlimited",
};

export function IdeaUsageSummaryCard({
  planName,
  features,
  collaborators,
  joinRequests,
  canManageCollaborators,
}: IdeaUsageSummaryProps) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-semibold">Usage overview</CardTitle>
        <p className="text-sm text-muted-foreground">You&apos;re working under the {planName} plan.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageRow metric={features} icon={<Sparkles className="size-4" />} />
        <UsageRow metric={collaborators} icon={<Users className="size-4" />} />
        {canManageCollaborators && joinRequests ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Join requests</p>
            <p className="mt-1">
              {joinRequests.pending > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{joinRequests.pending}</span> pending •{" "}
                  <span className="font-semibold text-foreground">{joinRequests.unseen}</span> unseen
                </>
              ) : (
                "No pending requests right now."
              )}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsageRow({ metric, icon }: { metric: UsageMetricSummary; icon: React.ReactNode }) {
  const statusColor = STATUS_COLORS[metric.status] ?? STATUS_COLORS.ok;
  const percent = metric.status === "unlimited" ? 0 : metric.progressPercent;
  const limitCopy =
    metric.limit == null
      ? "Unlimited"
      : `${metric.count.toLocaleString()} / ${metric.limit.toLocaleString()}`;
  const remainingCopy =
    metric.limit == null
      ? "No cap on this plan."
      : `${Math.max(0, metric.remaining ?? 0).toLocaleString()} remaining ${metric.periodLabel.toLowerCase()}`;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            {icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{metric.label}</p>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">{limitCopy}</div>
          <div>{STATUS_COPY[metric.status]}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div
            className={`h-2 rounded-full transition-all ${statusColor}`}
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="min-w-[4rem] text-right text-xs text-muted-foreground">{metric.periodLabel}</span>
      </div>
      <div className="text-xs text-muted-foreground">{remainingCopy}</div>
    </div>
  );
}
