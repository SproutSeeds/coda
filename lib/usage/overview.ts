import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { usageCosts } from "@/lib/db/schema/usage";
import { getCreditBalance } from "@/lib/db/credits";
import {
  COST_MODEL,
  getUsageCostBudgets,
  type UsageAction,
  type UsageCostBudget,
} from "@/lib/pricing/cost-model";
import type { CategoryKey } from "@/lib/usage/types";

export type UsageCostAggregate = {
  action: string;
  label: string;
  category: CategoryKey | null;
  vendor: string;
  unit: string;
  unitLabel: string | null;
  unitCost: number | null;
  totalQuantity: number;
  totalCost: number;
  occurrences: number;
  lastOccurredAtIso: string | null;
  projections: UsageCostBudget[] | null;
};

export type UsageLedgerEntry = {
  id: string;
  action: string;
  vendor: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  occurredAtIso: string;
};

export type UserUsageOverview = {
  credit: Awaited<ReturnType<typeof getCreditBalance>>;
  costAggregates: UsageCostAggregate[];
  recentLedger: UsageLedgerEntry[];
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
  const credit = await getCreditBalance({ type: "user", id: userId });

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

  const recentLedger: UsageLedgerEntry[] = ledgerRows.map((row) => {
    const occurredAt = row.occurredAt ?? new Date(0);
    return {
      id: row.id,
      action: row.action,
      vendor: row.vendor,
      unit: row.unit,
      quantity: numberFromNumeric(row.quantity),
      unitCost: numberFromNumeric(row.unitCost),
      totalCost: numberFromNumeric(row.totalCost),
      occurredAtIso: occurredAt.toISOString(),
    };
  });

  const aggregatesMap = new Map<string, UsageCostAggregate>();
  for (const entry of recentLedger) {
    const key = entry.action;
    const meta = COST_MODEL[key as UsageAction];
    const label = meta?.label ?? entry.action;
    const category = meta?.category ?? null;
    const unitLabel = meta?.unitLabel ?? null;
    const unitCost = meta?.unitCost ?? null;
    const projections = meta ? getUsageCostBudgets(key as UsageAction) : null;
    const existing = aggregatesMap.get(key);
    if (existing) {
      existing.totalQuantity += entry.quantity;
      existing.totalCost += entry.totalCost;
      existing.occurrences += 1;
      if (!existing.lastOccurredAtIso || existing.lastOccurredAtIso < entry.occurredAtIso) {
        existing.lastOccurredAtIso = entry.occurredAtIso;
      }
    } else {
      aggregatesMap.set(key, {
        action: entry.action,
        label,
        category,
        vendor: entry.vendor,
        unit: entry.unit,
        unitLabel,
        unitCost,
        totalQuantity: entry.quantity,
        totalCost: entry.totalCost,
        occurrences: 1,
        lastOccurredAtIso: entry.occurredAtIso,
        projections,
      });
    }
  }

  const costAggregates = Array.from(aggregatesMap.values()).sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));

  return {
    credit,
    costAggregates,
    recentLedger,
  };
}
