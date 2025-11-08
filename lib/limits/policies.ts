import { getDefaultPlan, getPlanById } from "@/lib/db/limits";
import type { LimitScopeType, PlanRecord } from "@/lib/db/limits";
import type { LimitMetric, MetricDefinition } from "@/lib/limits/types";
import { limitPeriodEnum } from "@/lib/db/schema/limits";

const WARN_RATIO_DEFAULT = 0.8;

type NumericRecord = Record<string, number>;

const DEFAULT_PLAN_LIMITS: Record<string, NumericRecord> = {
  free: {
    "ideas.per_user.lifetime": 5,
    "features.per_idea.lifetime": 50,
    "collaborators.per_idea.lifetime": 3,
    "publicIdeas.per_user.lifetime": 1,
    "joinRequests.per_idea.per_viewer.cooldownDays": 7,
    "mutations.per_user.daily": 500,
  },
  pro: {
    "ideas.per_user.lifetime": 50,
    "features.per_idea.lifetime": 500,
    "collaborators.per_idea.lifetime": 10,
    "publicIdeas.per_user.lifetime": 10,
    "joinRequests.per_idea.per_viewer.cooldownDays": 3,
    "mutations.per_user.daily": 5_000,
  },
  team: {
    "ideas.per_user.lifetime": 500,
    "features.per_idea.lifetime": 5_000,
    "collaborators.per_idea.lifetime": 50,
    "publicIdeas.per_user.lifetime": 100,
    "joinRequests.per_idea.per_viewer.cooldownDays": 1,
    "mutations.per_user.daily": 25_000,
  },
};

const FALLBACK_LIMITS: NumericRecord = DEFAULT_PLAN_LIMITS.free;

const SCOPE_USER: LimitScopeType = "user";
const SCOPE_IDEA: LimitScopeType = "idea";

const PERIOD_LIFETIME = limitPeriodEnum.enumValues[0];
const PERIOD_DAILY = limitPeriodEnum.enumValues[1];

const METRIC_DEFINITIONS: Record<LimitMetric, MetricDefinition> = {
  "ideas.per_user.lifetime": {
    metric: "ideas.per_user.lifetime",
    scope: SCOPE_USER,
    period: PERIOD_LIFETIME,
    warnRatio: WARN_RATIO_DEFAULT,
    supportsCounters: true,
  },
  "features.per_idea.lifetime": {
    metric: "features.per_idea.lifetime",
    scope: SCOPE_IDEA,
    period: PERIOD_LIFETIME,
    warnRatio: WARN_RATIO_DEFAULT,
    supportsCounters: true,
  },
  "collaborators.per_idea.lifetime": {
    metric: "collaborators.per_idea.lifetime",
    scope: SCOPE_IDEA,
    period: PERIOD_LIFETIME,
    warnRatio: WARN_RATIO_DEFAULT,
    supportsCounters: true,
  },
  "publicIdeas.per_user.lifetime": {
    metric: "publicIdeas.per_user.lifetime",
    scope: SCOPE_USER,
    period: PERIOD_LIFETIME,
    warnRatio: WARN_RATIO_DEFAULT,
    supportsCounters: true,
  },
  "joinRequests.per_idea.per_viewer.cooldownDays": {
    metric: "joinRequests.per_idea.per_viewer.cooldownDays",
    scope: SCOPE_IDEA,
    period: "cooldown",
    supportsCounters: false,
  },
  "mutations.per_user.daily": {
    metric: "mutations.per_user.daily",
    scope: SCOPE_USER,
    period: PERIOD_DAILY,
    warnRatio: WARN_RATIO_DEFAULT,
    supportsCounters: true,
  },
};

export function getMetricDefinition(metric: LimitMetric): MetricDefinition {
  return METRIC_DEFINITIONS[metric];
}

function readNumeric(features: unknown, key: LimitMetric): number | undefined {
  if (features && typeof features === "object" && !Array.isArray(features)) {
    const record = features as Record<string, unknown>;
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

export function getPlanLimit(plan: PlanRecord | null | undefined, metric: LimitMetric): number {
  if (plan) {
    const value = readNumeric(plan.features, metric);
    if (typeof value === "number") {
      return value;
    }
    const fallbackByPlan = DEFAULT_PLAN_LIMITS[plan.id];
    if (fallbackByPlan && typeof fallbackByPlan[metric] === "number") {
      return fallbackByPlan[metric];
    }
  }
  const fallback = FALLBACK_LIMITS[metric];
  if (typeof fallback === "number") {
    return fallback;
  }
  return Number.POSITIVE_INFINITY;
}

export async function resolvePlan(planId?: string | null): Promise<PlanRecord | null> {
  if (planId) {
    const plan = await getPlanById(planId);
    if (plan) return plan;
  }
  return getDefaultPlan();
}

export function computeWarnThreshold(limit: number, warnRatio?: number) {
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const ratio = typeof warnRatio === "number" ? warnRatio : WARN_RATIO_DEFAULT;
  return Math.floor(limit * ratio);
}
