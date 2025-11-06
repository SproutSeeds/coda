import "server-only";

import { Redis } from "@upstash/redis";

import { listPlans, type PlanRecord } from "@/lib/db/limits";
import { CREDIT_PRICE_USD_PER_UNIT, getCreditBalance } from "@/lib/db/credits";
import { computeWarnThreshold, getMetricDefinition, getPlanLimit } from "@/lib/limits/policies";
import { getUserUsageSummary } from "@/lib/limits/summary";
import { LIMIT_METRICS, type LimitMetric } from "@/lib/limits/types";
import { COST_MODEL, type UsageAction } from "@/lib/pricing/cost-model";

const CACHE_VERSION = 1;
const CACHE_TTL_SECONDS = 15 * 60;
const CACHE_KEY = `${resolveCachePrefix()}:cost-catalogue:v${CACHE_VERSION}`;

type CategoryId =
  | "creation"
  | "collaboration"
  | "delivery"
  | "authentication"
  | "analytics"
  | "devmode";

const CATEGORY_METADATA: Record<CategoryId, { label: string; description: string }> = {
  creation: {
    label: "Creation",
    description: "Core actions that generate new ideas and features inside your workspace.",
  },
  collaboration: {
    label: "Collaboration",
    description: "Invitations, join requests, and approvals that grow your team footprint.",
  },
  delivery: {
    label: "Delivery",
    description: "Exports and sharing flows that move data out of the platform.",
  },
  authentication: {
    label: "Authentication",
    description: "Security essentials like login emails and password helpers.",
  },
  analytics: {
    label: "Analytics",
    description: "Instrumentation events that feed usage dashboards and monitoring.",
  },
  devmode: {
    label: "Dev Mode",
    description: "On-device compute and bandwidth that power Dev Mode sessions.",
  },
};

type ActionMetadata = {
  label: string;
  description: string;
  category: CategoryId;
  metric?: LimitMetric;
  defaultCreditCharge?: number | null;
  cta?: "upgrade" | "top-up" | "docs";
  documentationUrl?: string | null;
};

const ACTION_METADATA: Record<UsageAction, ActionMetadata> = {
  "idea.create": {
    label: "Create idea",
    description: "Draft a new idea card including metadata, collaborators, and roadmap context.",
    category: "creation",
    metric: "ideas.per_user.lifetime",
    defaultCreditCharge: 1,
    cta: "upgrade",
  },
  "feature.create": {
    label: "Create feature",
    description: "Add a feature under an idea with task breakdown, status, and owner.",
    category: "creation",
    metric: "features.per_idea.lifetime",
    defaultCreditCharge: 0.5,
    cta: "upgrade",
  },
  "collaborator.invite": {
    label: "Invite collaborator",
    description: "Send an email invite so teammates can contribute to an idea.",
    category: "collaboration",
    metric: "collaborators.per_idea.lifetime",
    defaultCreditCharge: null,
    cta: "upgrade",
  },
  "collaborator.add": {
    label: "Add collaborator",
    description: "Approve a collaborator and grant access to the idea workspace.",
    category: "collaboration",
    metric: "collaborators.per_idea.lifetime",
    defaultCreditCharge: 1,
    cta: "upgrade",
  },
  "join-request.create": {
    label: "Submit join request",
    description: "Viewers request access to collaborate on an idea.",
    category: "collaboration",
    metric: "joinRequests.per_idea.per_viewer.cooldownDays",
    defaultCreditCharge: null,
    cta: "upgrade",
  },
  "idea.export": {
    label: "Export idea",
    description: "Generate a structured export of ideas and features for offline workflows.",
    category: "delivery",
    defaultCreditCharge: null,
    cta: "top-up",
  },
  "auth.email": {
    label: "Auth email",
    description: "Password resets and magic links sent through transactional email providers.",
    category: "authentication",
    defaultCreditCharge: null,
    cta: "top-up",
  },
  "analytics.event": {
    label: "Analytics event",
    description: "Telemetry emitted to monitor engagement and surface insights.",
    category: "analytics",
    defaultCreditCharge: null,
    cta: "docs",
    documentationUrl: "/docs/usage-limits-and-pricing",
  },
  "devmode.minute": {
    label: "Dev Mode minute",
    description: "Compute minute while the Dev Mode runner is active.",
    category: "devmode",
    defaultCreditCharge: null,
    cta: "top-up",
  },
  "devmode.byte": {
    label: "Dev Mode bandwidth",
    description: "Bytes transferred between the runner and dashboard during Dev Mode.",
    category: "devmode",
    defaultCreditCharge: null,
    cta: "top-up",
  },
};

export type CostCataloguePlan = {
  id: string;
  name: string;
  description: string | null;
};

export type CostCatalogueCategory = {
  id: CategoryId;
  label: string;
  description: string;
};

export type CostCataloguePlanLimit = {
  planId: string;
  planName: string;
  limit: number | null;
  warnThreshold: number | null;
  period: string | null;
};

export type CostCatalogueAction = {
  action: UsageAction;
  label: string;
  description: string;
  category: CategoryId;
  vendor: string;
  unit: string;
  unitCostUsd: number;
  creditsPerUnit: number;
  defaultCreditCharge: number | null;
  metric: LimitMetric | null;
  planLimits: CostCataloguePlanLimit[];
  cta: ActionMetadata["cta"];
  documentationUrl: string | null;
};

export type CostCatalogueMatrix = {
  categories: CostCatalogueCategory[];
  plans: CostCataloguePlan[];
  actions: CostCatalogueAction[];
  generatedAt: string;
};

export type CostCatalogueAllowances = {
  plan: Awaited<ReturnType<typeof getUserUsageSummary>>["plan"];
  credits: Awaited<ReturnType<typeof getCreditBalance>> & { updatedAtIso: string };
  metrics: Awaited<ReturnType<typeof getUserUsageSummary>>["metrics"];
  metricsById: Partial<Record<LimitMetric, Awaited<ReturnType<typeof getUserUsageSummary>>["metrics"][number]>>;
};

let memoryCache: { data: CostCatalogueMatrix; expiresAt: number } | null = null;

export async function getCostCatalogueMatrix(): Promise<CostCatalogueMatrix> {
  const cached = await readCatalogueCache();
  if (cached) {
    return cached;
  }

  const [plans] = await Promise.all([listPlans()]);

  const categories = buildCategories();
  const actions = buildActions(plans);

  const matrix: CostCatalogueMatrix = {
    categories,
    plans: plans.map(toCataloguePlan),
    actions,
    generatedAt: new Date().toISOString(),
  };

  await writeCatalogueCache(matrix);
  return matrix;
}

export async function getCostCatalogueAllowances(userId: string): Promise<CostCatalogueAllowances> {
  const [summary, credits] = await Promise.all([
    getUserUsageSummary(userId),
    getCreditBalance({ type: "user", id: userId }),
  ]);

  const metricsById = summary.metrics.reduce<Partial<Record<LimitMetric, (typeof summary.metrics)[number]>>>(
    (acc, metric) => {
      if ((LIMIT_METRICS as readonly LimitMetric[]).includes(metric.metric as LimitMetric)) {
        acc[metric.metric as LimitMetric] = metric;
      }
      return acc;
    },
    {},
  );

  return {
    plan: summary.plan,
    credits: { ...credits, updatedAtIso: credits.updatedAt.toISOString() },
    metrics: summary.metrics,
    metricsById,
  };
}

function buildCategories(): CostCatalogueCategory[] {
  return Object.entries(CATEGORY_METADATA).map(([id, meta]) => ({
    id: id as CategoryId,
    label: meta.label,
    description: meta.description,
  }));
}

function buildActions(plans: PlanRecord[]): CostCatalogueAction[] {
  const planLookup = plans.map(toCataloguePlan);
  const actions: CostCatalogueAction[] = [];

  for (const action of Object.keys(ACTION_METADATA) as UsageAction[]) {
    const cost = COST_MODEL[action];
    if (!cost) continue;
    const meta = ACTION_METADATA[action];

    const metric = meta.metric ?? null;
    const definition = metric ? getMetricDefinition(metric) : null;

    const planLimits = planLookup.map((plan) => {
      if (!metric || !definition) {
        return {
          planId: plan.id,
          planName: plan.name,
          limit: null,
          warnThreshold: null,
          period: null,
        } satisfies CostCataloguePlanLimit;
      }

      const planRecord = plans.find((row) => row.id === plan.id) ?? null;
      const rawLimit = planRecord ? getPlanLimit(planRecord, metric) : Number.POSITIVE_INFINITY;
      const limit = Number.isFinite(rawLimit) ? rawLimit : null;
      const warnThreshold = computeWarnThreshold(rawLimit, definition.warnRatio);

      return {
        planId: plan.id,
        planName: plan.name,
        limit,
        warnThreshold: warnThreshold ?? null,
        period: definition.period === "cooldown" ? "cooldown" : definition.period,
      } satisfies CostCataloguePlanLimit;
    });

    actions.push({
      action,
      label: meta.label,
      description: meta.description,
      category: meta.category,
      vendor: cost.vendor,
      unit: cost.unit,
      unitCostUsd: cost.unitCost,
      creditsPerUnit: Number.isFinite(cost.unitCost)
        ? Number((cost.unitCost / CREDIT_PRICE_USD_PER_UNIT).toFixed(6))
        : 0,
      defaultCreditCharge: meta.defaultCreditCharge ?? null,
      metric,
      planLimits,
      cta: meta.cta ?? null,
      documentationUrl: meta.documentationUrl ?? null,
    });
  }

  return actions.sort((a, b) => {
    if (a.category === b.category) {
      return a.label.localeCompare(b.label);
    }
    return CATEGORY_METADATA[a.category].label.localeCompare(CATEGORY_METADATA[b.category].label);
  });
}

function toCataloguePlan(plan: PlanRecord): CostCataloguePlan {
  return {
    id: plan.id,
    name: plan.name ?? plan.id,
    description: plan.description ?? null,
  };
}

type CachedPayload = {
  version: number;
  data: CostCatalogueMatrix;
};

async function readCatalogueCache(): Promise<CostCatalogueMatrix | null> {
  const cachedRedis = await readRedisCache();
  if (cachedRedis) {
    return cachedRedis;
  }

  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return memoryCache.data;
  }
  return null;
}

async function writeCatalogueCache(matrix: CostCatalogueMatrix) {
  memoryCache = { data: matrix, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
  await writeRedisCache(matrix);
}

async function readRedisCache(): Promise<CostCatalogueMatrix | null> {
  const redis = resolveRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<string>(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as CachedPayload;
    if (payload.version !== CACHE_VERSION) return null;
    return payload.data;
  } catch {
    return null;
  }
}

async function writeRedisCache(matrix: CostCatalogueMatrix) {
  const redis = resolveRedis();
  if (!redis) return;
  const payload: CachedPayload = {
    version: CACHE_VERSION,
    data: matrix,
  };
  try {
    await redis.set(CACHE_KEY, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write failures.
  }
}

function resolveCachePrefix() {
  return process.env.UPSTASH_CACHE_PREFIX ?? "coda:cache";
}

let redisInstance: Redis | null | undefined;

function resolveRedis(): Redis | null {
  if (redisInstance !== undefined) {
    return redisInstance;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || /replace-with|sample/i.test(url + token)) {
    redisInstance = null;
    return redisInstance;
  }
  redisInstance = new Redis({ url, token });
  return redisInstance;
}
