import "server-only";

import { gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { usageCosts } from "@/lib/db/schema/usage";
import { COST_MODEL } from "@/lib/pricing/cost-model";

type VendorDriftRow = {
  action: string;
  quantity: number;
  recordedCost: number;
  expectedCost: number;
  drift: number;
  driftRatio: number;
};

function numeric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function reconcileVendorCosts(options?: { days?: number }): Promise<VendorDriftRow[]> {
  const db = getDb();
  const days = options?.days ?? 1;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      action: usageCosts.action,
      quantity: sql<number>`sum(${usageCosts.quantity})`,
      totalCost: sql<number>`sum(${usageCosts.totalCost})`,
    })
    .from(usageCosts)
    .where(gte(usageCosts.occurredAt, cutoff))
    .groupBy(usageCosts.action);

  return rows.map((row) => {
    const model = COST_MODEL[row.action as keyof typeof COST_MODEL];
    const quantity = numeric(row.quantity);
    const recorded = numeric(row.totalCost);
    const expected = model ? model.unitCost * quantity : recorded;
    const drift = recorded - expected;
    const driftRatio = expected !== 0 ? drift / expected : 0;
    return {
      action: row.action,
      quantity,
      recordedCost: recorded,
      expectedCost: expected,
      drift,
      driftRatio,
    };
  });
}
