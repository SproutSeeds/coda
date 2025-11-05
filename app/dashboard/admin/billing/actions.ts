"use server";

import { desc, inArray, sql } from "drizzle-orm";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { creditBalances } from "@/lib/db/schema/credits";
import { usageCosts } from "@/lib/db/schema/usage";
import { adjustCreditBalance } from "@/lib/db/credits";

function numeric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export type UsageAggregate = {
  payerType: "user" | "workspace";
  payerId: string;
  totalCost: number;
  totalQuantity: number;
  lastOccurredAt: Date | null;
  email?: string | null;
};

export type CreditBalanceRow = {
  payerType: "user" | "workspace";
  payerId: string;
  available: number;
  onHold: number;
  updatedAt: Date;
  email?: string | null;
};

export async function listUsageAggregatesAction(limit = 50): Promise<UsageAggregate[]> {
  await requirePlatformAdmin();
  const db = getDb();
  const rows = await db
    .select({
      payerType: usageCosts.payerType,
      payerId: usageCosts.payerId,
      totalCost: sql<number>`sum(${usageCosts.totalCost})`,
      totalQuantity: sql<number>`sum(${usageCosts.quantity})`,
      lastOccurredAt: sql<Date | null>`max(${usageCosts.occurredAt})`,
    })
    .from(usageCosts)
    .groupBy(usageCosts.payerType, usageCosts.payerId)
    .orderBy(desc(sql`sum(${usageCosts.totalCost})`))
    .limit(limit);

  const result: UsageAggregate[] = rows.map((row) => ({
    payerType: row.payerType as "user" | "workspace",
    payerId: row.payerId,
    totalCost: numeric(row.totalCost),
    totalQuantity: numeric(row.totalQuantity),
    lastOccurredAt: row.lastOccurredAt ?? null,
  }));

  const userPayers = Array.from(new Set(result.filter((row) => row.payerType === "user").map((row) => row.payerId)));
  if (userPayers.length > 0) {
    const userRows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userPayers));
    for (const aggregate of result) {
      if (aggregate.payerType === "user") {
        const info = userRows.find((u) => u.id === aggregate.payerId);
        if (info) {
          aggregate.email = info.email;
        }
      }
    }
  }

  return result;
}

export async function listCreditBalancesAction(limit = 50): Promise<CreditBalanceRow[]> {
  await requirePlatformAdmin();
  const db = getDb();
  const rows = await db
    .select({
      payerType: creditBalances.payerType,
      payerId: creditBalances.payerId,
      availableCredits: creditBalances.availableCredits,
      onHoldCredits: creditBalances.onHoldCredits,
      updatedAt: creditBalances.updatedAt,
    })
    .from(creditBalances)
    .orderBy(desc(creditBalances.availableCredits))
    .limit(limit);

  const balances: CreditBalanceRow[] = rows.map((row) => ({
    payerType: row.payerType as "user" | "workspace",
    payerId: row.payerId,
    available: numeric(row.availableCredits),
    onHold: numeric(row.onHoldCredits),
    updatedAt: row.updatedAt ?? new Date(),
  }));

  const userIds = Array.from(new Set(balances.filter((row) => row.payerType === "user").map((row) => row.payerId)));
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const balance of balances) {
      if (balance.payerType === "user") {
        const entry = userRows.find((u) => u.id === balance.payerId);
        if (entry) {
          balance.email = entry.email;
        }
      }
    }
  }

  return balances;
}

export async function grantCreditsAction(payload: { payerType: "user" | "workspace"; payerId: string; amount: number; note?: string }) {
  await requirePlatformAdmin();
  if (!Number.isFinite(payload.amount) || payload.amount === 0) {
    throw new Error("Provide a non-zero amount.");
  }
  const result = await adjustCreditBalance({
    payer: { type: payload.payerType, id: payload.payerId },
    delta: payload.amount,
    entryType: payload.amount > 0 ? "adjustment" : "usage",
    metadata: payload.note ? { note: payload.note } : {},
    createdBy: null,
  });
  return {
    payer: result.balance.payer,
    available: result.balance.available,
    onHold: result.balance.onHold,
  };
}
