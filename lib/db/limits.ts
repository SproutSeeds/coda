import "server-only";

import { sql, and, eq, desc, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { plans, userPlans } from "@/lib/db/schema/plans";
import {
  auditLimitEvents,
  limitEventTypeEnum,
  limitOverrideStatusEnum,
  limitOverrides,
  limitPeriodEnum,
  limitScopeTypeEnum,
  usageCounters,
} from "@/lib/db/schema/limits";

export type PlanRecord = typeof plans.$inferSelect;
export type PlanInsert = typeof plans.$inferInsert;
export type UserPlanRecord = typeof userPlans.$inferSelect;
export type LimitOverrideRecord = typeof limitOverrides.$inferSelect;
export type LimitOverrideInsert = typeof limitOverrides.$inferInsert;
export type UsageCounterRecord = typeof usageCounters.$inferSelect;
export type LimitOverrideStatus = (typeof limitOverrideStatusEnum.enumValues)[number];

export type LimitScopeType = (typeof limitScopeTypeEnum.enumValues)[number];
export type LimitPeriod = (typeof limitPeriodEnum.enumValues)[number];
export type LimitEventType = (typeof limitEventTypeEnum.enumValues)[number];

type DbClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DbClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
export type DbOrTx = DbClient | TransactionClient;

function resolveDb(db?: DbOrTx): DbOrTx {
  return db ?? getDb();
}

export async function listPlans(options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  return db.select().from(plans).orderBy(plans.isDefault, plans.name);
}

export async function getDefaultPlan(options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  const [row] = await db.select().from(plans).where(eq(plans.isDefault, true)).limit(1);
  return row ?? null;
}

export async function getPlanById(planId: string, options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  const [row] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  return row ?? null;
}

export async function upsertPlan(payload: PlanInsert, options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  await db
    .insert(plans)
    .values(payload)
    .onConflictDoUpdate({ target: plans.id, set: { ...payload, updatedAt: new Date() } });
}

export async function getUserPlan(userId: string, options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  const [row] = await db
    .select({
      plan: plans,
      assignment: userPlans,
    })
    .from(userPlans)
    .innerJoin(plans, eq(plans.id, userPlans.planId))
    .where(eq(userPlans.userId, userId))
    .limit(1);

  if (!row) return null;

  return {
    plan: row.plan,
    assignment: row.assignment,
  } satisfies {
    plan: PlanRecord;
    assignment: UserPlanRecord;
  };
}

export async function assignUserPlan({
  userId,
  planId,
  orgId,
  startsAt = new Date(),
  db: inputDb,
}: {
  userId: string;
  planId: string;
  orgId?: string | null;
  startsAt?: Date;
  db?: DbOrTx;
}) {
  const db = resolveDb(inputDb);
  await db
    .insert(userPlans)
    .values({
      userId,
      planId,
      orgId: orgId ?? null,
      startsAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPlans.userId,
      set: {
        planId,
        orgId: orgId ?? null,
        startsAt,
        updatedAt: new Date(),
      },
    });
}

export async function listLimitOverrides(
  scope: { type: LimitScopeType; id: string; metric?: string },
  options: { status?: LimitOverrideStatus | LimitOverrideStatus[]; db?: DbOrTx } = {},
) {
  const db = resolveDb(options.db);
  const clauses = [
    eq(limitOverrides.scopeType, scope.type),
    eq(limitOverrides.scopeId, scope.id),
  ];
  if (scope.metric) {
    clauses.push(eq(limitOverrides.metric, scope.metric));
  }
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    clauses.push(inArray(limitOverrides.status, statuses));
  }

  return db
    .select()
    .from(limitOverrides)
    .where(and(...clauses))
    .orderBy(desc(limitOverrides.createdAt));
}

export async function listPendingLimitOverrides(options: { limit?: number; db?: DbOrTx } = {}): Promise<LimitOverrideRecord[]> {
  const db = resolveDb(options.db);
  return db
    .select()
    .from(limitOverrides)
    .where(eq(limitOverrides.status, "pending"))
    .orderBy(desc(limitOverrides.createdAt))
    .limit(options.limit ?? 200);
}

export async function resolveLimitOverride(
  id: string,
  resolution: {
    status: Exclude<LimitOverrideStatus, "pending">;
    limitValue?: number;
    expiresAt?: Date | null;
    reason?: string | null;
    planId?: string | null;
    resolutionNote?: string | null;
    resolvedBy: string;
    db?: DbOrTx;
  },
): Promise<LimitOverrideRecord | null> {
  const db = resolveDb(resolution.db);
  const now = new Date();
  const updates: Partial<LimitOverrideInsert> = {
    status: resolution.status,
    resolvedAt: now,
    resolvedBy: resolution.resolvedBy,
    updatedAt: now,
  };

  if (typeof resolution.limitValue === "number") {
    updates.limitValue = resolution.limitValue;
  }
  if (resolution.expiresAt !== undefined) {
    updates.expiresAt = resolution.expiresAt ?? null;
  }
  if (resolution.reason !== undefined) {
    updates.reason = resolution.reason ?? null;
  }
  if (resolution.planId !== undefined) {
    updates.planId = resolution.planId ?? null;
  }
  if (resolution.resolutionNote !== undefined) {
    updates.resolutionNote = resolution.resolutionNote ?? null;
  }

  const [updated] = await db
    .update(limitOverrides)
    .set(updates)
    .where(eq(limitOverrides.id, id))
    .returning();

  return updated ?? null;
}

export async function createLimitOverrideRequest(
  payload: {
    scopeType: LimitScopeType;
    scopeId: string;
    metric: string;
    limitValue: number;
    planId?: string | null;
    expiresAt?: Date | null;
    reason?: string | null;
    createdBy?: string | null;
    db?: DbOrTx;
  },
): Promise<LimitOverrideRecord | null> {
  const db = resolveDb(payload.db);
  const [created] = await db.insert(limitOverrides).values({
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    metric: payload.metric,
    limitValue: payload.limitValue,
    planId: payload.planId ?? null,
    expiresAt: payload.expiresAt ?? null,
    reason: payload.reason ?? null,
    createdBy: payload.createdBy ?? null,
    status: "pending",
  }).returning();
  return created ?? null;
}

export type ManualLimitOverridePayload = {
  scopeType: LimitScopeType;
  scopeId: string;
  metric: string;
  limitValue: number;
  planId?: string | null;
  expiresAt?: Date | null;
  reason?: string | null;
  resolutionNote?: string | null;
  status?: Exclude<LimitOverrideStatus, "pending">;
  createdBy?: string | null;
  db?: DbOrTx;
};

export async function createManualLimitOverride(payload: ManualLimitOverridePayload): Promise<LimitOverrideRecord | null> {
  const db = resolveDb(payload.db);
  const now = new Date();
  const status: Exclude<LimitOverrideStatus, "pending"> = payload.status ?? "approved";
  const resolvedAt = now;
  const resolvedBy = payload.createdBy ?? null;
  const [record] = await db
    .insert(limitOverrides)
    .values({
      scopeType: payload.scopeType,
      scopeId: payload.scopeId,
      metric: payload.metric,
      limitValue: payload.limitValue,
      planId: payload.planId ?? null,
      expiresAt: payload.expiresAt ?? null,
      reason: payload.reason ?? null,
      createdBy: payload.createdBy ?? null,
      status,
      resolvedAt,
      resolvedBy,
      resolutionNote: payload.resolutionNote ?? null,
      updatedAt: now,
    })
    .returning();

  return record ?? null;
}

export async function upsertLimitOverride(payload: Omit<LimitOverrideRecord, "createdAt" | "updatedAt">, options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  await db
    .insert(limitOverrides)
    .values({ ...payload, createdAt: new Date(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: limitOverrides.id,
      set: {
        scopeType: payload.scopeType,
        scopeId: payload.scopeId,
        metric: payload.metric,
        limitValue: payload.limitValue,
        planId: payload.planId ?? null,
        expiresAt: payload.expiresAt ?? null,
        reason: payload.reason ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getUsageCounter(
  scope: { type: LimitScopeType; id: string },
  metric: string,
  period: LimitPeriod,
  periodKey: string,
  options: { db?: DbOrTx } = {},
) {
  const db = resolveDb(options.db);
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.scopeType, scope.type),
        eq(usageCounters.scopeId, scope.id),
        eq(usageCounters.metric, metric),
        eq(usageCounters.period, period),
        eq(usageCounters.periodKey, periodKey),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function incrementUsageCounter({
  scope,
  metric,
  period,
  periodKey,
  increment = 1,
  db: inputDb,
}: {
  scope: { type: LimitScopeType; id: string };
  metric: string;
  period: LimitPeriod;
  periodKey: string;
  increment?: number;
  db?: DbOrTx;
}) {
  const db = resolveDb(inputDb);
  await db
    .insert(usageCounters)
    .values({
      scopeType: scope.type,
      scopeId: scope.id,
      metric,
      period,
      periodKey,
      count: increment,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [usageCounters.scopeType, usageCounters.scopeId, usageCounters.metric, usageCounters.period, usageCounters.periodKey],
      set: {
        count: sql`${usageCounters.count} + ${increment}`,
        updatedAt: new Date(),
      },
    });
}

export async function writeLimitEvent(event: {
  scope: { type: LimitScopeType; id: string };
  planId?: string | null;
  metric: string;
  event: LimitEventType;
  value: number;
  limit: number;
  action?: string | null;
  meta?: Record<string, unknown> | null;
  createdBy?: string | null;
  db?: DbOrTx;
}) {
  const db = resolveDb(event.db);
  await db.insert(auditLimitEvents).values({
    scopeType: event.scope.type,
    scopeId: event.scope.id,
    planId: event.planId ?? null,
    metric: event.metric,
    event: event.event,
    value: event.value,
    limit: event.limit,
    action: event.action ?? null,
    meta: event.meta ?? {},
    createdBy: event.createdBy ?? null,
  });
}

export type LimitEventSummary = {
  metric: string;
  blocks24h: number;
  warns24h: number;
  blocks7d: number;
  warns7d: number;
  blocks30d: number;
  warns30d: number;
  lastBlockAt: Date | null;
  lastWarnAt: Date | null;
};

export async function getLimitEventSummary(options: { db?: DbOrTx } = {}): Promise<LimitEventSummary[]> {
  const db = resolveDb(options.db);
  const result = await db.execute(sql`
    SELECT
      metric,
      SUM(CASE WHEN event = 'block' AND created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) AS blocks_24h,
      SUM(CASE WHEN event = 'warn' AND created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) AS warns_24h,
      SUM(CASE WHEN event = 'block' AND created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS blocks_7d,
      SUM(CASE WHEN event = 'warn' AND created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS warns_7d,
      SUM(CASE WHEN event = 'block' AND created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS blocks_30d,
      SUM(CASE WHEN event = 'warn' AND created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS warns_30d,
      MAX(CASE WHEN event = 'block' THEN created_at ELSE NULL END) AS last_block_at,
      MAX(CASE WHEN event = 'warn' THEN created_at ELSE NULL END) AS last_warn_at
    FROM audit_limit_events
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY metric
    ORDER BY metric ASC;
  `);

  return (Array.isArray(result) ? result : []).map((row: Record<string, unknown>) => ({
    metric: String(row.metric),
    blocks24h: Number(row.blocks_24h ?? 0),
    warns24h: Number(row.warns_24h ?? 0),
    blocks7d: Number(row.blocks_7d ?? 0),
    warns7d: Number(row.warns_7d ?? 0),
    blocks30d: Number(row.blocks_30d ?? 0),
    warns30d: Number(row.warns_30d ?? 0),
    lastBlockAt: row.last_block_at ? new Date(row.last_block_at as string | Date) : null,
    lastWarnAt: row.last_warn_at ? new Date(row.last_warn_at as string | Date) : null,
  }));
}
