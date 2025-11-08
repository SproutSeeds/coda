import type { LimitPeriod, LimitScopeType } from "@/lib/db/limits";

export const LIMIT_METRICS = [
  "ideas.per_user.lifetime",
  "features.per_idea.lifetime",
  "collaborators.per_idea.lifetime",
  "publicIdeas.per_user.lifetime",
  "joinRequests.per_idea.per_viewer.cooldownDays",
  "mutations.per_user.daily",
] as const;

export type LimitMetric = (typeof LIMIT_METRICS)[number];

export type LimitMode = "unlimited" | "ok" | "warn" | "blocked";

export type MetricPeriod = LimitPeriod | "cooldown";

export type LimitPayerType = "user" | "workspace";

export type LimitPayer = {
  type: LimitPayerType;
  id: string;
};

export type LimitPayerStrategy = "actor" | "workspace" | "shared";

export type LimitPayerResolution = {
  primary: LimitPayer;
  fallback?: LimitPayer | null;
  strategy: LimitPayerStrategy;
  metadata?: Record<string, unknown>;
};

export type MetricDefinition = {
  metric: LimitMetric;
  scope: LimitScopeType;
  period: MetricPeriod;
  warnRatio?: number;
  supportsCounters: boolean;
};

export type EffectiveLimit = {
  metric: LimitMetric;
  planId: string | null;
  limit: number | null;
  overrideLimit?: number | null;
  period: MetricPeriod;
};

export type LimitCreditRequest = {
  amount: number;
  payer?: LimitPayerResolution;
  allowDebt?: boolean;
};

export type LimitCreditResult = {
  amount: number;
  unit: "credits";
  payer: LimitPayerResolution;
  allowDebt: boolean;
  chargedPayer?: LimitPayer | null;
};

export type LimitCheckResult = {
  metric: LimitMetric;
  mode: LimitMode;
  limit: number | null;
  count: number;
  remaining: number | null;
  periodKey: string | null;
  planId: string | null;
  overrideId?: string | null;
  payer: LimitPayerResolution;
  credit?: LimitCreditResult | null;
};

export type LimitCheckRequest = {
  scope: { type: LimitScopeType; id: string };
  metric: LimitMetric;
  increment?: number;
  planId?: string | null;
  userId?: string;
  dryRun?: boolean;
  payer?: LimitPayerResolution;
  credit?: LimitCreditRequest;
};
