import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreditBalanceSummary } from "@/lib/db/credits";
import type { UsageMetricSummary, UserUsageSummary } from "@/lib/limits/summary";

type UsageLimitsSectionProps = {
  plan: UserUsageSummary["plan"];
  metrics: UsageMetricSummary[];
  credits: CreditBalanceSummary;
};

const creditFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const countFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PROGRESS_STATE_CLASS: Record<UsageMetricSummary["status"], string> = {
  ok: "bg-primary",
  warn: "bg-amber-500",
  blocked: "bg-rose-500",
  unlimited: "bg-muted-foreground/40",
};

const STATUS_COPY: Record<UsageMetricSummary["status"], string> = {
  ok: "Within limit",
  warn: "Approaching limit",
  blocked: "Limit reached",
  unlimited: "Unlimited on this plan",
};

export function UsageLimitsSection({ plan, metrics, credits }: UsageLimitsSectionProps) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-semibold">Usage &amp; limits</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current plan: <span className="font-medium text-foreground">{plan.name}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <CreditSummary credits={credits} />
        <div className="space-y-5">
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Usage counters are still warming up. Check back soon.</p>
          ) : (
            metrics.map((metric) => <MetricRow key={metric.metric} metric={metric} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreditSummary({ credits }: { credits: CreditBalanceSummary }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between text-sm font-medium text-foreground">
        <span>Available credits</span>
        <span>{creditFormatter.format(credits.available)} credits</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {credits.autoTopUpEnabled ? (
          <span>
            Auto top-up is <span className="text-foreground">enabled</span>. We’ll add{" "}
            {creditFormatter.format(credits.autoTopUpCredits || 0)} credits whenever your balance drops below{" "}
            {creditFormatter.format(credits.autoTopUpThreshold || 0)}.
          </span>
        ) : (
          <span>Auto top-up is disabled. Top up manually before your cloud actions pause.</span>
        )}
      </div>
    </div>
  );
}

function MetricRow({ metric }: { metric: UsageMetricSummary }) {
  const progressClass = PROGRESS_STATE_CLASS[metric.status] ?? PROGRESS_STATE_CLASS.ok;
  const percent = metric.status === "unlimited" ? 0 : metric.progressPercent;
  const limitCopy =
    metric.limit == null ? "Unlimited" : `${countFormatter.format(metric.count)} / ${countFormatter.format(metric.limit)}`;
  const remainingCopy =
    metric.limit == null
      ? "No cap on this plan."
      : `${countFormatter.format(metric.remaining ?? 0)} remaining ${metric.periodLabel.toLowerCase()}`;

  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-4 backdrop-blur">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{metric.label}</p>
          <p className="text-xs text-muted-foreground">{metric.description}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground sm:text-sm">
          <div className="font-semibold text-foreground">{limitCopy}</div>
          <div>{STATUS_COPY[metric.status]}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div
            className={`h-2 rounded-full transition-all ${progressClass}`}
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
