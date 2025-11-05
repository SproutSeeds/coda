import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getDefaultPlan, getUserPlan } from "@/lib/db/limits";
import type { LimitScopeType, PlanRecord } from "@/lib/db/limits";
import { usageCounters } from "@/lib/db/schema/limits";
import { computeWarnThreshold, getMetricDefinition, getPlanLimit } from "@/lib/limits/policies";
import { LIMIT_METRICS, type LimitMetric, type MetricDefinition } from "@/lib/limits/types";

const USER_SCOPE: LimitScopeType = "user";
const IDEA_SCOPE: LimitScopeType = "idea";

const USER_METRICS: LimitMetric[] = LIMIT_METRICS.filter(
  (metric) => getMetricDefinition(metric).scope === USER_SCOPE && getMetricDefinition(metric).period !== "cooldown",
);

const IDEA_METRICS: LimitMetric[] = ["features.per_idea.lifetime", "collaborators.per_idea.lifetime"];

const METRIC_LABELS: Record<LimitMetric, { label: string; description: string; periodLabel: string }> = {
  "ideas.per_user.lifetime": {
    label: "Ideas created",
    description: "Total ideas you’ve drafted across all time.",
    periodLabel: "Lifetime",
  },
  "features.per_idea.lifetime": {
    label: "Features per idea",
    description: "Tracked per idea; review limits within idea details.",
    periodLabel: "Lifetime",
  },
  "collaborators.per_idea.lifetime": {
    label: "Collaborators per idea",
    description: "Tracked per idea; manage collaborators inside each idea.",
    periodLabel: "Lifetime",
  },
  "publicIdeas.per_user.lifetime": {
    label: "Public ideas",
    description: "Ideas shared publicly and discoverable by the community.",
    periodLabel: "Lifetime",
  },
  "joinRequests.per_idea.per_viewer.cooldownDays": {
    label: "Join requests",
    description: "Cooldown enforced per idea; owners can view in Join queue.",
    periodLabel: "Cooldown",
  },
  "mutations.per_user.daily": {
    label: "Mutations executed",
    description: "Server mutations you’ve triggered today across the dashboard.",
    periodLabel: "Today",
  },
};

export type UsageMetricSummary = {
  metric: LimitMetric;
  label: string;
  description: string;
  periodLabel: string;
  count: number;
  limit: number | null;
  remaining: number | null;
  status: "ok" | "warn" | "blocked" | "unlimited";
  warnThreshold: number | null;
  progressPercent: number;
};

export type UserUsageSummary = {
  plan: {
    id: string | null;
    name: string;
  };
  metrics: UsageMetricSummary[];
};

export type IdeaUsageSummary = {
  plan: {
    id: string | null;
    name: string;
  };
  metrics: {
    features: UsageMetricSummary;
    collaborators: UsageMetricSummary;
  };
};

function resolvePlanLabel(plan: PlanRecord | null | undefined): string {
  if (!plan) return "Free";
  return plan.name ?? plan.id ?? "Free";
}

function currentPeriodKey(definition: MetricDefinition, now: Date) {
  if (definition.period === "lifetime") return "lifetime";
  if (definition.period === "daily") return now.toISOString().slice(0, 10);
  if (definition.period === "monthly") return now.toISOString().slice(0, 7);
  return "lifetime";
}

function computeStatus(count: number, limit: number | null, warnThreshold: number | null): UsageMetricSummary["status"] {
  if (!Number.isFinite(limit) || limit == null) return "unlimited";
  if (count >= limit) return "blocked";
  if (warnThreshold != null && count >= warnThreshold) return "warn";
  return "ok";
}

export async function getUserUsageSummary(userId: string): Promise<UserUsageSummary> {
  const db = getDb();
  const now = new Date();

  const assignment = await getUserPlan(userId);
  const planRecord = assignment?.plan ?? (await getDefaultPlan());

  if (USER_METRICS.length === 0) {
    return {
      plan: {
        id: planRecord?.id ?? null,
        name: resolvePlanLabel(planRecord),
      },
      metrics: [],
    };
  }

  const rows = await db
    .select({
      metric: usageCounters.metric,
      period: usageCounters.period,
      periodKey: usageCounters.periodKey,
      count: usageCounters.count,
    })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.scopeType, USER_SCOPE),
        eq(usageCounters.scopeId, userId),
        inArray(usageCounters.metric, USER_METRICS),
      ),
    );

  const usageMap = new Map<string, number>();
  for (const row of rows) {
    usageMap.set(`${row.metric}:${row.periodKey}`, row.count ?? 0);
  }

  const metrics: UsageMetricSummary[] = USER_METRICS.map((metric) => {
    const definition = getMetricDefinition(metric);
    const periodKey = currentPeriodKey(definition, now);
    const count = usageMap.get(`${metric}:${periodKey}`) ?? 0;
    const rawLimit = getPlanLimit(planRecord, metric);
    const limit = Number.isFinite(rawLimit) ? rawLimit : null;
    const warnThreshold = computeWarnThreshold(rawLimit, definition.warnRatio);
    const status = computeStatus(count, limit, warnThreshold);
    const progressPercent =
      limit && limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
    const remaining = limit != null ? Math.max(0, limit - count) : null;
    const copy = METRIC_LABELS[metric];

    return {
      metric,
      label: copy?.label ?? metric,
      description: copy?.description ?? "",
      periodLabel: copy?.periodLabel ?? definition.period,
      count,
      limit,
      remaining,
      status,
      warnThreshold: warnThreshold ?? null,
      progressPercent,
    };
  }).filter(Boolean);

  return {
    plan: {
      id: planRecord?.id ?? null,
      name: resolvePlanLabel(planRecord),
    },
    metrics,
  };
}

const IDEA_METRIC_COPY: Record<LimitMetric, { label: string; description: string; periodLabel: string }> = {
  "features.per_idea.lifetime": {
    label: "Features added",
    description: "Lifetime total of features ever created for this idea.",
    periodLabel: "Lifetime",
  },
  "collaborators.per_idea.lifetime": {
    label: "Collaborators added",
    description: "Lifetime collaborators invited or added to this idea.",
    periodLabel: "Lifetime",
  },
  "ideas.per_user.lifetime": METRIC_LABELS["ideas.per_user.lifetime"],
  "publicIdeas.per_user.lifetime": METRIC_LABELS["publicIdeas.per_user.lifetime"],
  "joinRequests.per_idea.per_viewer.cooldownDays": METRIC_LABELS["joinRequests.per_idea.per_viewer.cooldownDays"],
  "mutations.per_user.daily": METRIC_LABELS["mutations.per_user.daily"],
};

function buildMetricSummary({
  metric,
  definition,
  count,
  plan,
}: {
  metric: LimitMetric;
  definition: MetricDefinition;
  count: number;
  plan: PlanRecord | null | undefined;
}): UsageMetricSummary {
  const rawLimit = getPlanLimit(plan, metric);
  const limit = Number.isFinite(rawLimit) ? rawLimit : null;
  const warnThreshold = computeWarnThreshold(rawLimit, definition.warnRatio);
  const status = computeStatus(count, limit, warnThreshold);
  const progressPercent = limit && limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const remaining = limit != null ? Math.max(0, limit - count) : null;
  const copy = IDEA_METRIC_COPY[metric] ?? METRIC_LABELS[metric];

  return {
    metric,
    label: copy?.label ?? metric,
    description: copy?.description ?? "",
    periodLabel: copy?.periodLabel ?? definition.period,
    count,
    limit,
    remaining,
    status,
    warnThreshold: warnThreshold ?? null,
    progressPercent,
  };
}

export async function getIdeaUsageSummary(ideaId: string, viewerId: string): Promise<IdeaUsageSummary> {
  const db = getDb();
  const now = new Date();

  const assignment = await getUserPlan(viewerId);
  const planRecord = assignment?.plan ?? (await getDefaultPlan());

  const counters = await db
    .select({
      metric: usageCounters.metric,
      periodKey: usageCounters.periodKey,
      count: usageCounters.count,
    })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.scopeType, IDEA_SCOPE),
        eq(usageCounters.scopeId, ideaId),
        inArray(usageCounters.metric, IDEA_METRICS),
      ),
    );

  const usage = new Map<string, number>();
  for (const row of counters) {
    usage.set(`${row.metric}:${row.periodKey}`, row.count ?? 0);
  }

  const [featuresMetric, collaboratorsMetric] = IDEA_METRICS.map((metric) => {
    const definition = getMetricDefinition(metric);
    const periodKey = currentPeriodKey(definition, now);
    const count = usage.get(`${metric}:${periodKey}`) ?? 0;
    return buildMetricSummary({ metric, definition, count, plan: planRecord });
  });

  return {
    plan: {
      id: planRecord?.id ?? null,
      name: resolvePlanLabel(planRecord),
    },
    metrics: {
      features: featuresMetric,
      collaborators: collaboratorsMetric,
    },
  };
}
