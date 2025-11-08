import "server-only";

import { and, eq, isNull, ne, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import type { LimitPeriod, LimitScopeType } from "@/lib/db/limits";
import { ideas, ideaCollaborators, ideaFeatures } from "@/lib/db/schema";
import { limitPeriodEnum, usageCounters } from "@/lib/db/schema/limits";
import type { LimitMetric } from "@/lib/limits/types";
import { LIMIT_METRICS } from "@/lib/limits/types";
import { getMetricDefinition } from "@/lib/limits/policies";

type CanonicalCounter = {
  scopeType: LimitScopeType;
  scopeId: string;
  metric: LimitMetric;
  period: LimitPeriod;
  periodKey: string;
  count: number;
};

type ReconcileMetricResult = {
  metric: LimitMetric;
  applied: number;
  deleted: number;
  skipped: boolean;
  reason?: string;
};

const PERIOD_LIFETIME = limitPeriodEnum.enumValues[0];

type CanonicalBuilder = (now: Date) => Promise<CanonicalCounter[]>;

const buildIdeaTotals: CanonicalBuilder = async (_now) => {
  void _now;
  const db = getDb();
  const rows = await db
    .select({
      scopeId: ideas.userId,
      count: sql<number>`count(*)`,
    })
    .from(ideas)
    .where(isNull(ideas.deletedAt))
    .groupBy(ideas.userId);

  return rows
    .map((row) => ({
      scopeType: "user" as const,
      scopeId: row.scopeId,
      metric: "ideas.per_user.lifetime" as const,
      period: PERIOD_LIFETIME,
      periodKey: "lifetime",
      count: Number(row.count),
    }))
    .filter((record) => record.count > 0);
};

const buildPublicIdeaTotals: CanonicalBuilder = async (_now) => {
  void _now;
  const db = getDb();
  const rows = await db
    .select({
      scopeId: ideas.userId,
      count: sql<number>`count(*)`,
    })
    .from(ideas)
    .where(and(isNull(ideas.deletedAt), eq(ideas.visibility, "public")))
    .groupBy(ideas.userId);

  return rows
    .map((row) => ({
      scopeType: "user" as const,
      scopeId: row.scopeId,
      metric: "publicIdeas.per_user.lifetime" as const,
      period: PERIOD_LIFETIME,
      periodKey: "lifetime",
      count: Number(row.count),
    }))
    .filter((record) => record.count > 0);
};

const buildFeatureTotals: CanonicalBuilder = async (_now) => {
  void _now;
  const db = getDb();
  const rows = await db
    .select({
      scopeId: ideaFeatures.ideaId,
      count: sql<number>`count(*)`,
    })
    .from(ideaFeatures)
    .where(isNull(ideaFeatures.deletedAt))
    .groupBy(ideaFeatures.ideaId);

  return rows
    .map((row) => ({
      scopeType: "idea" as const,
      scopeId: row.scopeId,
      metric: "features.per_idea.lifetime" as const,
      period: PERIOD_LIFETIME,
      periodKey: "lifetime",
      count: Number(row.count),
    }))
    .filter((record) => record.count > 0);
};

const buildCollaboratorTotals: CanonicalBuilder = async (_now) => {
  void _now;
  const db = getDb();
  const rows = await db
    .select({
      scopeId: ideaCollaborators.ideaId,
      count: sql<number>`count(*)`,
    })
    .from(ideaCollaborators)
    .where(ne(ideaCollaborators.role, "owner"))
    .groupBy(ideaCollaborators.ideaId);

  return rows
    .map((row) => ({
      scopeType: "idea" as const,
      scopeId: row.scopeId,
      metric: "collaborators.per_idea.lifetime" as const,
      period: PERIOD_LIFETIME,
      periodKey: "lifetime",
      count: Number(row.count),
    }))
    .filter((record) => record.count > 0);
};

const METRIC_BUILDERS: Partial<Record<LimitMetric, CanonicalBuilder>> = {
  "ideas.per_user.lifetime": buildIdeaTotals,
  "publicIdeas.per_user.lifetime": buildPublicIdeaTotals,
  "features.per_idea.lifetime": buildFeatureTotals,
  "collaborators.per_idea.lifetime": buildCollaboratorTotals,
};

function makeCounterKey(scopeId: string, periodKey: string) {
  return `${scopeId}:${periodKey}`;
}

export async function reconcileUsageCounters(options?: { metrics?: LimitMetric[]; now?: Date }) {
  const now = options?.now ?? new Date();
  const metrics = (options?.metrics ?? LIMIT_METRICS).filter((metric) => {
    const definition = getMetricDefinition(metric);
    return definition.supportsCounters && definition.period !== "cooldown";
  });

  const results: ReconcileMetricResult[] = [];
  const db = getDb();

  for (const metric of metrics) {
    const definition = getMetricDefinition(metric);
    if (definition.period === "cooldown" || !definition.supportsCounters) {
      results.push({ metric, applied: 0, deleted: 0, skipped: true, reason: "Metric not counter-based." });
      continue;
    }

    const builder = METRIC_BUILDERS[metric];
    if (!builder) {
      results.push({ metric, applied: 0, deleted: 0, skipped: true, reason: "No canonical builder defined." });
      continue;
    }

    const canonical = await builder(now);
    const period = definition.period as LimitPeriod;

    const existing = await db
      .select({
        scopeId: usageCounters.scopeId,
        periodKey: usageCounters.periodKey,
        count: usageCounters.count,
      })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.metric, metric),
          eq(usageCounters.scopeType, definition.scope),
          eq(usageCounters.period, period),
        ),
      );

    const existingMap = new Map<string, { periodKey: string; count: number }>();
    for (const row of existing) {
      existingMap.set(makeCounterKey(row.scopeId, row.periodKey), { periodKey: row.periodKey, count: Number(row.count) });
    }

    const pendingDeletes = new Map(existingMap);
    const upserts: CanonicalCounter[] = [];
    let applied = 0;

    for (const counter of canonical) {
      const key = makeCounterKey(counter.scopeId, counter.periodKey);
      const current = existingMap.get(key);
      pendingDeletes.delete(key);

      if (!current || current.count !== counter.count) {
        upserts.push(counter);
      }
    }

    if (upserts.length > 0) {
      await db
        .insert(usageCounters)
        .values(
          upserts.map((entry) => ({
            scopeType: entry.scopeType,
            scopeId: entry.scopeId,
            metric: entry.metric,
            period: entry.period,
            periodKey: entry.periodKey,
            count: entry.count,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [
            usageCounters.scopeType,
            usageCounters.scopeId,
            usageCounters.metric,
            usageCounters.period,
            usageCounters.periodKey,
          ],
          set: {
            count: sql`excluded.count`,
            updatedAt: now,
          },
        });
      applied += upserts.length;
    }

    let deleted = 0;
    const leftoverKeys = [...pendingDeletes.keys()];
    if (leftoverKeys.length > 0) {
      const pairConditions = leftoverKeys.map((key) => {
        const [scopeId, periodKey] = key.split(":");
        return and(eq(usageCounters.scopeId, scopeId), eq(usageCounters.periodKey, periodKey));
      });

      const scopedPredicate =
        pairConditions.length === 1 ? pairConditions[0] : or(...pairConditions);

      await db
        .delete(usageCounters)
        .where(
          and(
            eq(usageCounters.metric, metric),
            eq(usageCounters.scopeType, definition.scope),
            eq(usageCounters.period, period),
            scopedPredicate,
          ),
        );
      deleted = leftoverKeys.length;
    }

    results.push({ metric, applied, deleted, skipped: false });
  }

  return results;
}

export type { ReconcileMetricResult };
