import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { listPlans, type PlanRecord } from "@/lib/db/limits";
import { usageCosts } from "@/lib/db/schema/usage";
import { getMetricDefinition, getPlanLimit } from "@/lib/limits/policies";
import { getUserUsageSummary } from "@/lib/limits/summary";
import { getCreditBalance } from "@/lib/db/credits";
import { LIMIT_METRICS, type LimitMetric } from "@/lib/limits/types";

export type UsageCostAggregate = {
  action: string;
  vendor: string;
  unit: string;
  totalQuantity: number;
  totalCost: number;
  occurrences: number;
  lastOccurredAt: Date | null;
};

export type UsageLedgerEntry = {
  id: string;
  action: string;
  vendor: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  occurredAt: Date;
};

export type PlanComparisonRow = {
  metric: string;
  label: string;
  plans: Array<{
    id: string;
    name: string;
    limit: number | null;
  }>;
};

export type UserUsageOverview = {
  credit: Awaited<ReturnType<typeof getCreditBalance>>;
  usageSummary: Awaited<ReturnType<typeof getUserUsageSummary>>;
  costAggregates: UsageCostAggregate[];
  recentLedger: UsageLedgerEntry[];
  planComparison: PlanComparisonRow[];
};

function numberFromNumeric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getUserUsageOverview(userId: string): Promise<UserUsageOverview> {
  const db = getDb();
  const [credit, usageSummary, planRecords] = await Promise.all([
    getCreditBalance({ type: "user", id: userId }),
    getUserUsageSummary(userId),
    listPlans(),
  ]);

  const ledgerRows = await db
    .select({
      id: usageCosts.id,
      action: usageCosts.action,
      vendor: usageCosts.vendor,
      unit: usageCosts.unit,
      quantity: usageCosts.quantity,
      unitCost: usageCosts.unitCost,
      totalCost: usageCosts.totalCost,
      occurredAt: usageCosts.occurredAt,
    })
    .from(usageCosts)
    .where(and(eq(usageCosts.payerType, "user"), eq(usageCosts.payerId, userId)))
    .orderBy(desc(usageCosts.occurredAt))
    .limit(200);

  const recentLedger: UsageLedgerEntry[] = ledgerRows.map((row) => ({
    id: row.id,
    action: row.action,
    vendor: row.vendor,
    unit: row.unit,
    quantity: numberFromNumeric(row.quantity),
    unitCost: numberFromNumeric(row.unitCost),
    totalCost: numberFromNumeric(row.totalCost),
    occurredAt: row.occurredAt ?? new Date(0),
  }));

  const aggregatesMap = new Map<string, UsageCostAggregate>();
  for (const entry of recentLedger) {
    const key = entry.action;
    const existing = aggregatesMap.get(key);
    if (existing) {
      existing.totalQuantity += entry.quantity;
      existing.totalCost += entry.totalCost;
      existing.occurrences += 1;
      if (!existing.lastOccurredAt || existing.lastOccurredAt < entry.occurredAt) {
        existing.lastOccurredAt = entry.occurredAt;
      }
    } else {
      aggregatesMap.set(key, {
        action: entry.action,
        vendor: entry.vendor,
        unit: entry.unit,
        totalQuantity: entry.quantity,
        totalCost: entry.totalCost,
        occurrences: 1,
        lastOccurredAt: entry.occurredAt,
      });
    }
  }

  const costAggregates = Array.from(aggregatesMap.values()).sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));

  const planComparison = buildPlanComparison(planRecords, usageSummary.metrics.map((metric) => metric.metric as LimitMetric));

  return {
    credit,
    usageSummary,
    costAggregates,
    recentLedger,
    planComparison,
  };
}

function buildPlanComparison(plans: PlanRecord[], metrics: LimitMetric[]): PlanComparisonRow[] {
  const uniqueMetricSet = new Set<LimitMetric>(metrics);
  for (const metric of LIMIT_METRICS) {
    uniqueMetricSet.add(metric);
  }

  return Array.from(uniqueMetricSet).map((metric) => {
    const definition = getMetricDefinition(metric);
    const planValues = plans.map((plan) => {
      let limit: number | null = getPlanLimit(plan, metric);
      if (!Number.isFinite(limit)) {
        limit = null;
      }
      return {
        id: plan.id,
        name: plan.name ?? plan.id ?? "Unnamed",
        limit,
      };
    });
    return {
      metric,
      label: definition.metric,
      plans: planValues,
    };
  });
}
