import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { SerializableLimitEventSummary } from "./actions";

type LimitInsightsProps = {
  summary: SerializableLimitEventSummary[];
};

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelativeDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return relativeTime.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) {
    return relativeTime.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 60) {
    return relativeTime.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  return relativeTime.format(diffMonths, "month");
}

function formatRate(blocks: number, warns: number) {
  const total = blocks + warns;
  if (total <= 0) return "0%";
  const percent = (blocks / total) * 100;
  return `${percent.toFixed(1)}%`;
}

export function LimitInsights({ summary }: LimitInsightsProps) {
  if (summary.length === 0) {
    return (
      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground">Limit activity</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No warn or block events detected in the last 30 days.
        </CardContent>
      </Card>
    );
  }

  const totals = summary.reduce(
    (acc, row) => {
      acc.blocks24h += row.blocks24h;
      acc.warns24h += row.warns24h;
      acc.blocks7d += row.blocks7d;
      acc.warns7d += row.warns7d;
      acc.blocks30d += row.blocks30d;
      acc.warns30d += row.warns30d;
      return acc;
    },
    { blocks24h: 0, warns24h: 0, blocks7d: 0, warns7d: 0, blocks30d: 0, warns30d: 0 },
  );

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-semibold text-foreground">Limit activity (last 30 days)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Track warn and block trends across metrics. Block rate uses 30-day totals.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocks (24h)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totals.blocks24h}</p>
            <p className="text-xs text-muted-foreground">Warns: {totals.warns24h}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocks (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totals.blocks7d}</p>
            <p className="text-xs text-muted-foreground">Warns: {totals.warns7d}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocks (30d)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totals.blocks30d}</p>
            <p className="text-xs text-muted-foreground">Warns: {totals.warns30d}</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className="px-3 py-2 text-left font-semibold">24h</th>
                <th className="px-3 py-2 text-left font-semibold">7d</th>
                <th className="px-3 py-2 text-left font-semibold">30d</th>
                <th className="px-3 py-2 text-left font-semibold">Block rate</th>
                <th className="px-3 py-2 text-left font-semibold">Last block</th>
                <th className="px-3 py-2 text-left font-semibold">Last warn</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.metric} className="border-t border-border/60 text-foreground/90">
                  <td className="px-3 py-2 font-medium">{row.metric}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-foreground">{row.blocks24h}</span>
                    <span className="text-muted-foreground"> / {row.warns24h}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-foreground">{row.blocks7d}</span>
                    <span className="text-muted-foreground"> / {row.warns7d}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-foreground">{row.blocks30d}</span>
                    <span className="text-muted-foreground"> / {row.warns30d}</span>
                  </td>
                  <td className="px-3 py-2">{formatRate(row.blocks30d, row.warns30d)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatRelativeDate(row.lastBlockAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatRelativeDate(row.lastWarnAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
