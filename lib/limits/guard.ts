import {
  assignUserPlan,
  getDefaultPlan,
  getUsageCounter,
  getUserPlan,
  incrementUsageCounter,
  listLimitOverrides,
  writeLimitEvent,
} from "@/lib/db/limits";
import type { LimitOverrideRecord, PlanRecord } from "@/lib/db/limits";
import type { DbOrTx } from "@/lib/db/limits";
import { chargeCredits, CreditInsufficientBalanceError, type CreditPayer } from "@/lib/db/credits";
import { limitPeriodEnum } from "@/lib/db/schema/limits";
import { computeWarnThreshold, getMetricDefinition, getPlanLimit, resolvePlan } from "@/lib/limits/policies";
import { actorPays } from "@/lib/limits/payer";
import type {
  LimitCheckRequest,
  LimitCheckResult,
  LimitCreditResult,
  LimitMode,
  LimitPayer,
  LimitPayerResolution,
  MetricDefinition,
} from "@/lib/limits/types";
import { trackEvent } from "@/lib/utils/analytics";

export class LimitExceededError extends Error {
  constructor(public readonly result: LimitCheckResult, message = "Limit exceeded") {
    super(message);
    this.name = "LimitExceededError";
  }
}

export type EnforceLimitRequest = LimitCheckRequest & { message?: string; db?: DbOrTx };

type PeriodKeyFn = (now: Date) => string;

const PERIOD_LIFETIME = limitPeriodEnum.enumValues[0];
const PERIOD_DAILY = limitPeriodEnum.enumValues[1];
const PERIOD_MONTHLY = limitPeriodEnum.enumValues[2];

const PERIOD_KEY_RESOLVERS: Record<string, PeriodKeyFn> = {
  [PERIOD_LIFETIME]: () => "lifetime",
  [PERIOD_DAILY]: (now: Date) => now.toISOString().slice(0, 10),
  [PERIOD_MONTHLY]: (now: Date) => now.toISOString().slice(0, 7),
};

function determinePlanId(plan?: PlanRecord | null): string | null {
  return plan?.id ?? null;
}

async function ensurePlanForUser(userId: string | undefined, fallbackPlanId: string | null | undefined, db?: DbOrTx) {
  if (!userId) {
    if (fallbackPlanId) {
      return resolvePlan(fallbackPlanId);
    }
    return getDefaultPlan({ db });
  }

  const assignment = await getUserPlan(userId, { db });
  if (assignment) return assignment.plan;

  const defaultPlan = await getDefaultPlan({ db });
  if (defaultPlan) {
    await assignUserPlan({ userId, planId: defaultPlan.id, startsAt: new Date(), db });
  }
  return defaultPlan;
}

function resolvePeriodKey(definition: MetricDefinition, now: Date) {
  if (definition.period === "cooldown") return null;
  const resolver = PERIOD_KEY_RESOLVERS[definition.period];
  if (!resolver) return null;
  return resolver(now);
}

function resolveMode(nextCount: number, limit: number, warnThreshold: number | null): LimitMode {
  if (!Number.isFinite(limit)) return "unlimited";
  if (nextCount > limit) return "blocked";
  if (warnThreshold && nextCount >= warnThreshold) return "warn";
  return "ok";
}

function pickActiveOverride(overrides: LimitOverrideRecord[], now: Date) {
  return overrides.find((override) => !override.expiresAt || override.expiresAt.getTime() > now.getTime()) ?? null;
}

function normalizePayerResolution(resolution: LimitPayerResolution): LimitPayerResolution {
  return {
    primary: resolution.primary,
    fallback: resolution.fallback ?? null,
    strategy: resolution.strategy,
    metadata: resolution.metadata ?? {},
  };
}

function resolvePayer(options: LimitCheckRequest): LimitPayerResolution {
  if (options.payer) {
    return normalizePayerResolution(options.payer);
  }
  if (options.userId) {
    return normalizePayerResolution(actorPays(options.userId));
  }
  throw new Error(`Unable to resolve payer for metric ${options.metric}. Provide options.payer or userId.`);
}

function resolveCreditCharge(
  options: LimitCheckRequest,
  defaultPayer: LimitPayerResolution,
): LimitCreditResult | null {
  if (!options.credit) return null;
  const amount = options.credit.amount;
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const payer = options.credit.payer ? normalizePayerResolution(options.credit.payer) : defaultPayer;
  return {
    amount,
    unit: "credits",
    payer,
    allowDebt: options.credit.allowDebt ?? false,
  };
}

function buildEventMeta({
  increment,
  periodKey,
  payer,
  credit,
}: {
  increment: number;
  periodKey: string;
  payer: LimitPayerResolution;
  credit: LimitCreditResult | null;
}) {
  const meta: Record<string, unknown> = {
    increment,
    periodKey,
    payerType: payer.primary.type,
    payerId: payer.primary.id,
    payerStrategy: payer.strategy,
  };

  if (payer.fallback) {
    meta.payerFallbackType = payer.fallback.type;
    meta.payerFallbackId = payer.fallback.id;
  }
  if (credit) {
    meta.creditAmount = credit.amount;
    meta.creditUnit = credit.unit;
    meta.creditAllowDebt = credit.allowDebt;
    meta.creditPayerType = credit.payer.primary.type;
    meta.creditPayerId = credit.payer.primary.id;
    meta.creditPayerStrategy = credit.payer.strategy;
    if (credit.payer.fallback) {
      meta.creditPayerFallbackType = credit.payer.fallback.type;
      meta.creditPayerFallbackId = credit.payer.fallback.id;
    }
    if (credit.chargedPayer) {
      meta.creditChargedPayerType = credit.chargedPayer.type;
      meta.creditChargedPayerId = credit.chargedPayer.id;
    }
  }

  return meta;
}

async function emitLimitAnalytics(event: "limit.warned" | "limit.blocked", payload: {
  metric: string;
  scope: LimitCheckRequest["scope"];
  planId: string | null;
  count: number;
  limit: number | null;
  increment: number;
  periodKey: string | null;
  userId?: string;
  payer: LimitPayerResolution;
  credit?: LimitCreditResult | null;
}) {
  try {
    await trackEvent({
      name: event,
      properties: {
        metric: payload.metric,
        scopeType: payload.scope.type,
        scopeId: payload.scope.id,
        planId: payload.planId,
        count: payload.count,
        limit: payload.limit,
        increment: payload.increment,
        periodKey: payload.periodKey,
        userId: payload.userId ?? null,
        payerType: payload.payer.primary.type,
        payerId: payload.payer.primary.id,
        payerStrategy: payload.payer.strategy,
        creditAmount: payload.credit?.amount ?? null,
        creditAllowDebt: payload.credit?.allowDebt ?? false,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("limits: failed to emit analytics", { event, error });
    }
  }
}

function toCreditPayer(payer: LimitPayer): CreditPayer {
  return {
    type: payer.type,
    id: payer.id,
  };
}

async function settleCreditCharge(options: {
  request: LimitCheckRequest;
  credit: LimitCreditResult;
  increment: number;
  periodKey: string | null;
  db?: DbOrTx;
}) {
  const candidates: LimitPayer[] = [options.credit.payer.primary];
  if (options.credit.payer.fallback) {
    candidates.push(options.credit.payer.fallback);
  }

  let lastError: CreditInsufficientBalanceError | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      await chargeCredits({
        payer: toCreditPayer(candidate),
        amount: options.credit.amount,
        source: options.request.metric,
        referenceId: options.request.scope.id,
        metadata: {
          scopeType: options.request.scope.type,
          scopeId: options.request.scope.id,
          periodKey: options.periodKey,
          increment: options.increment,
          strategy: options.credit.payer.strategy,
        },
        createdBy: options.request.userId ?? null,
        allowNegative: options.credit.allowDebt,
        triggerAutoTopUp: index === 0,
        db: options.db,
      });
      return candidate;
    } catch (error) {
      if (error instanceof CreditInsufficientBalanceError) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to settle credit charge for limit request.");
}

export async function checkAndConsumeLimit(options: LimitCheckRequest & { db?: DbOrTx }): Promise<LimitCheckResult> {
  const now = new Date();
  const increment = options.increment ?? 1;
  if (increment <= 0) {
    throw new Error(`Limit increment must be positive for metric ${options.metric}`);
  }

  const metricDefinition = getMetricDefinition(options.metric);
  const plan = await ensurePlanForUser(options.userId, options.planId ?? null, options.db);
  const planId = determinePlanId(plan);
  const baseLimit = getPlanLimit(plan, options.metric);
  const payer = resolvePayer(options);
  const credit = resolveCreditCharge(options, payer);

  if (!metricDefinition.supportsCounters || !Number.isFinite(baseLimit)) {
    return {
      metric: options.metric,
      mode: "unlimited",
      count: 0,
      remaining: null,
      limit: null,
      planId,
      periodKey: null,
      payer,
      credit,
    } satisfies LimitCheckResult;
  }

  if (metricDefinition.period === "cooldown") {
    return {
      metric: options.metric,
      mode: "unlimited",
      count: 0,
      remaining: null,
      limit: null,
      planId,
      periodKey: null,
      payer,
      credit,
    } satisfies LimitCheckResult;
  }

  const overrides = await listLimitOverrides(
    { type: metricDefinition.scope, id: options.scope.id, metric: options.metric },
    { status: "approved", db: options.db },
  );
  const activeOverride = pickActiveOverride(overrides, now);
  const hardLimit = activeOverride?.limitValue ?? baseLimit;
  const warnThreshold = computeWarnThreshold(hardLimit, metricDefinition.warnRatio);

  const periodKey = resolvePeriodKey(metricDefinition, now);
  if (!periodKey) {
    return {
      metric: options.metric,
      mode: "unlimited",
      count: 0,
      remaining: null,
      limit: null,
      planId,
      periodKey: null,
      payer,
      credit,
    } satisfies LimitCheckResult;
  }

  const counter = await getUsageCounter(options.scope, options.metric, metricDefinition.period, periodKey, { db: options.db });
  const currentCount = counter?.count ?? 0;
  const nextCount = currentCount + increment;
  const mode = resolveMode(nextCount, hardLimit, warnThreshold);

  if (mode === "blocked") {
    await writeLimitEvent({
      scope: options.scope,
      planId,
      metric: options.metric,
      event: "block",
      value: nextCount,
      limit: hardLimit,
      action: null,
      meta: buildEventMeta({ increment, periodKey, payer, credit }),
      createdBy: options.userId ?? null,
      db: options.db,
    });

    await emitLimitAnalytics("limit.blocked", {
      metric: options.metric,
      scope: options.scope,
      planId,
      count: nextCount,
      limit: hardLimit,
      increment,
      periodKey,
      userId: options.userId,
      payer,
      credit,
    });

    return {
      metric: options.metric,
      mode,
      limit: hardLimit,
      count: currentCount,
      remaining: 0,
      periodKey,
      planId,
      overrideId: activeOverride?.id ?? null,
      payer,
      credit,
    } satisfies LimitCheckResult;
  }

  if (!options.dryRun && credit) {
    const chargedPayer = await settleCreditCharge({
      request: options,
      credit,
      increment,
      periodKey,
      db: options.db,
    });
    credit.chargedPayer = chargedPayer;
  }

  if (!options.dryRun) {
    await incrementUsageCounter({
      scope: options.scope,
      metric: options.metric,
      period: metricDefinition.period,
      periodKey,
      increment,
      db: options.db,
    });

    if (mode === "warn") {
      await writeLimitEvent({
        scope: options.scope,
        planId,
        metric: options.metric,
        event: "warn",
        value: nextCount,
        limit: hardLimit,
        action: null,
        meta: buildEventMeta({ increment, periodKey, payer, credit }),
        createdBy: options.userId ?? null,
        db: options.db,
      });

      await emitLimitAnalytics("limit.warned", {
        metric: options.metric,
        scope: options.scope,
        planId,
        count: nextCount,
        limit: hardLimit,
        increment,
        periodKey,
        userId: options.userId,
        payer,
        credit,
      });
    }
  }

  return {
    metric: options.metric,
    mode,
    limit: hardLimit,
    count: nextCount,
    remaining: Math.max(0, hardLimit - nextCount),
    periodKey,
    planId,
    overrideId: activeOverride?.id ?? null,
    payer,
    credit,
  } satisfies LimitCheckResult;
}

export async function enforceLimit(options: EnforceLimitRequest) {
  const { message, ...request } = options;
  const result = await checkAndConsumeLimit(request);
  if (result.mode === "blocked") {
    throw new LimitExceededError(result, message ?? "Limit exceeded");
  }
  return result;
}
