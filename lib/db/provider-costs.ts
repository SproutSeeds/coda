import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { usageCosts } from "@/lib/db/schema/usage";
import {
  providerCostEvents,
  providerCostSnapshots,
  providerCostReconciliations,
  providerMetricWindowEnum,
} from "@/lib/db/schema/provider-costs";

type DbClient = ReturnType<typeof getDb>;

export type ProviderMetricWindow = (typeof providerMetricWindowEnum.enumValues)[number];

export type ProviderCostEventInput = {
  provider: string;
  metric: string;
  windowStart: Date;
  windowEnd: Date;
  quantity: number;
  costUsd: number;
  currency?: string;
  fetchedAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function recordProviderCostEvents(db: DbClient, events: ProviderCostEventInput[]) {
  if (events.length === 0) return;
  await db.insert(providerCostEvents).values(
    events.map((event) => ({
      provider: event.provider,
      metric: event.metric,
      windowStart: event.windowStart,
      windowEnd: event.windowEnd,
      quantity: event.quantity,
      costUsd: event.costUsd,
      currency: event.currency ?? "usd",
      fetchedAt: event.fetchedAt ?? new Date(),
      metadata: event.metadata ?? {},
    })),
  );
}

export type ProviderCostSnapshotInput = {
  provider: string;
  metric: string;
  window: ProviderMetricWindow;
  windowStart: Date;
  windowEnd: Date;
  quantity: number;
  costUsd: number;
  currency?: string;
  sampleCount?: number;
  lastFetchedAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function upsertProviderCostSnapshot(db: DbClient, snapshot: ProviderCostSnapshotInput) {
  await db
    .insert(providerCostSnapshots)
    .values({
      provider: snapshot.provider,
      metric: snapshot.metric,
      window: snapshot.window,
      windowStart: snapshot.windowStart,
      windowEnd: snapshot.windowEnd,
      quantity: snapshot.quantity,
      costUsd: snapshot.costUsd,
      currency: snapshot.currency ?? "usd",
      sampleCount: snapshot.sampleCount ?? 1,
      lastFetchedAt: snapshot.lastFetchedAt ?? new Date(),
      metadata: snapshot.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [
        providerCostSnapshots.provider,
        providerCostSnapshots.metric,
        providerCostSnapshots.window,
        providerCostSnapshots.windowStart,
      ],
      set: {
        quantity: snapshot.quantity,
        costUsd: snapshot.costUsd,
        currency: snapshot.currency ?? "usd",
        sampleCount: snapshot.sampleCount ?? 1,
        lastFetchedAt: snapshot.lastFetchedAt ?? new Date(),
        metadata: snapshot.metadata ?? {},
        updatedAt: new Date(),
        windowEnd: snapshot.windowEnd,
      },
    });
}

export type ProviderReconciliationInput = {
  provider: string;
  metric: string;
  window: ProviderMetricWindow;
  windowStart: Date;
  windowEnd: Date;
  providerQuantity: number;
  providerCostUsd: number;
  metadata?: Record<string, unknown>;
};

export async function createProviderReconciliation(db: DbClient, input: ProviderReconciliationInput) {
  const internal = await db
    .select({
      quantity: sql<number>`coalesce(sum(${usageCosts.quantity}), 0)` as unknown as number,
      cost: sql<number>`coalesce(sum(${usageCosts.totalCost}), 0)` as unknown as number,
    })
    .from(usageCosts)
    .where(
      and(
        eq(usageCosts.vendor, input.provider),
        gte(usageCosts.occurredAt, input.windowStart),
        lte(usageCosts.occurredAt, input.windowEnd),
      ),
    );

  const internalQuantity = internal[0]?.quantity ?? 0;
  const internalCostUsd = internal[0]?.cost ?? 0;
  const varianceUsd = input.providerCostUsd - internalCostUsd;
  const varianceRatio = internalCostUsd !== 0 ? varianceUsd / internalCostUsd : 0;

  await db.insert(providerCostReconciliations).values({
    provider: input.provider,
    metric: input.metric,
    window: input.window,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    providerQuantity: input.providerQuantity,
    providerCostUsd: input.providerCostUsd,
    internalQuantity,
    internalCostUsd,
    varianceUsd,
    varianceRatio,
    metadata: input.metadata ?? {},
  });

  return {
    providerQuantity: input.providerQuantity,
    providerCostUsd: input.providerCostUsd,
    internalQuantity,
    internalCostUsd,
    varianceUsd,
    varianceRatio,
  };
}
