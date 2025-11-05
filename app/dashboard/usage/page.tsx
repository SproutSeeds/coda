import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { getUserUsageOverview } from "@/lib/usage/overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const metadata = {
  title: "Usage Dashboard",
};

export default async function UsageDashboardPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/login");
  }

  const overview = await getUserUsageOverview(user.id);

  const totalCost = overview.costAggregates.reduce((sum, aggregate) => sum + aggregate.totalCost, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usage dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor how you’re consuming credits across ideas, collaborators, and Dev Mode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/account">Back to account</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/usage/export" prefetch={false}>
              Export ledger
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Available credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-foreground">
              {numberFormatter.format(overview.credit.available)} <span className="text-base font-medium text-muted-foreground">credits</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Auto top-up {overview.credit.autoTopUpEnabled ? `enabled at ${numberFormatter.format(overview.credit.autoTopUpThreshold)} credits` : "disabled"}.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Current plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xl font-semibold text-foreground">{overview.usageSummary.plan.name}</p>
            <p className="text-xs text-muted-foreground">
              Keep an eye on soft warnings to avoid surprises—upgrade or sponsor when you need more headroom.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Estimated cloud spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-foreground">{currencyFormatter.format(totalCost)}</p>
            <p className="text-xs text-muted-foreground">Based on logged actions and vendor buffers.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quota progress</h2>
          <p className="text-sm text-muted-foreground">Lifetime and daily counters per metric, including remaining headroom.</p>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Metric</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {overview.usageSummary.metrics.map((metric) => (
                  <tr key={metric.metric} className="text-foreground/90">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{metric.label ?? metric.metric}</div>
                      <div className="text-xs text-muted-foreground">{metric.metric}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{metric.periodLabel}</td>
                    <td className="px-4 py-3">{numberFormatter.format(metric.count)}{metric.limit != null ? ` / ${numberFormatter.format(metric.limit)}` : ""}</td>
                    <td className="px-4 py-3">{metric.limit != null ? numberFormatter.format(metric.remaining ?? 0) : "Unlimited"}</td>
                    <td className="px-4 py-3 capitalize">{metric.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Cost by action</h2>
            <p className="text-sm text-muted-foreground">Aggregated from the most recent ledger entries.</p>
          </div>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Total cost</th>
                  <th className="px-4 py-3">Occurrences</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {overview.costAggregates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No logged usage yet.
                    </td>
                  </tr>
                ) : (
                  overview.costAggregates.map((row) => (
                    <tr key={row.action}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.action}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.vendor}</td>
                      <td className="px-4 py-3">{numberFormatter.format(row.totalQuantity)} {row.unit}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(row.totalCost)}</td>
                      <td className="px-4 py-3">{row.occurrences}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.lastOccurredAt ? row.lastOccurredAt.toLocaleString() : "–"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent activity</h2>
            <p className="text-sm text-muted-foreground">Latest 200 ledger entries for cloud usage charges.</p>
          </div>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {overview.recentLedger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No activity logged yet.
                    </td>
                  </tr>
                ) : (
                  overview.recentLedger.slice(0, 25).map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.occurredAt.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{entry.action}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.vendor}</td>
                      <td className="px-4 py-3">{numberFormatter.format(entry.quantity)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.unit}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(entry.totalCost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {overview.recentLedger.length > 25 ? (
              <div className="px-4 py-3 text-right text-xs text-muted-foreground">
                Showing 25 of {overview.recentLedger.length} entries. Export for the full ledger.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Plan comparison</h2>
          <p className="text-sm text-muted-foreground">See how limits scale across tiers before upgrading.</p>
        </div>
        <Card className="border-border/70 bg-card/95">
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Metric</th>
                  {overview.planComparison[0]?.plans.map((plan) => (
                    <th key={plan.id} className="px-4 py-3">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {overview.planComparison.map((row) => (
                  <tr key={row.metric}>
                    <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                    {row.plans.map((plan) => (
                      <td key={plan.id} className="px-4 py-3">
                        {plan.limit != null ? numberFormatter.format(plan.limit) : "Unlimited"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Cost estimates include a buffer to cover vendor price fluctuations. Credits are charged as you create ideas, invite collaborators, send onboarding emails, or run Dev Mode.
      </p>
    </div>
  );
}
