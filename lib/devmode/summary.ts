import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { devUsageSessions } from "@/lib/db/schema";
import { usageCosts } from "@/lib/db/schema/usage";

export type DevModeUsageSummary = {
  last30DaysMinutes: number;
  monthToDateMinutes: number;
  totalSessions: number;
  lastSessionAt: Date | null;
  lastSessionDurationMinutes: number;
  billedTo: "personal" | "workspace";
  minuteCostUsd: number;
};

const MS_IN_MINUTE = 60_000;

function numeric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getDevModeUsageSummary(userId: string): Promise<DevModeUsageSummary> {
  const db = getDb();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [last30Agg, monthAgg, totalSessionRow, latestSessionRow, minuteCharges] = await Promise.all([
    db
      .select({ totalMs: sql<number>`coalesce(sum(${devUsageSessions.durationMs}), 0)` })
      .from(devUsageSessions)
      .where(and(eq(devUsageSessions.userId, userId), gte(devUsageSessions.startedAt, thirtyDaysAgo))),
    db
      .select({ totalMs: sql<number>`coalesce(sum(${devUsageSessions.durationMs}), 0)` })
      .from(devUsageSessions)
      .where(and(eq(devUsageSessions.userId, userId), gte(devUsageSessions.startedAt, startOfMonth))),
    db
      .select({ total: sql<number>`count(*)` })
      .from(devUsageSessions)
      .where(eq(devUsageSessions.userId, userId)),
    db
      .select({
        startedAt: devUsageSessions.startedAt,
        durationMs: devUsageSessions.durationMs,
      })
      .from(devUsageSessions)
      .where(eq(devUsageSessions.userId, userId))
      .orderBy(desc(devUsageSessions.startedAt))
      .limit(1),
    db
      .select({
        totalMinutes: usageCosts.quantity,
        totalCost: usageCosts.totalCost,
        payerType: usageCosts.payerType,
      })
      .from(usageCosts)
      .where(and(eq(usageCosts.payerType, "user"), eq(usageCosts.payerId, userId), eq(usageCosts.action, "devmode.minute")))
      .orderBy(desc(usageCosts.occurredAt))
      .limit(50),
  ]);

  const last30Ms = last30Agg[0]?.totalMs ?? 0;
  const monthMs = monthAgg[0]?.totalMs ?? 0;

  const totalSessions = numeric(totalSessionRow[0]?.total ?? 0);
  const lastSessionAt = latestSessionRow[0]?.startedAt ?? null;
  const lastDurationMs = numeric(latestSessionRow[0]?.durationMs ?? 0);

  let totalMinutesCharged = 0;
  let totalCostUsd = 0;
  let billedTo: DevModeUsageSummary["billedTo"] = "personal";

  for (const row of minuteCharges) {
    totalMinutesCharged += numeric(row.totalMinutes);
    totalCostUsd += numeric(row.totalCost);
  }

  if (minuteCharges.length > 0 && minuteCharges[0].payerType === "workspace") {
    billedTo = "workspace";
  }

  const minuteCostUsd = totalMinutesCharged > 0 ? totalCostUsd / totalMinutesCharged : 0;

  return {
    last30DaysMinutes: last30Ms / MS_IN_MINUTE,
    monthToDateMinutes: monthMs / MS_IN_MINUTE,
    totalSessions,
    lastSessionAt,
    lastSessionDurationMinutes: lastDurationMs / MS_IN_MINUTE,
    billedTo,
    minuteCostUsd,
  };
}
