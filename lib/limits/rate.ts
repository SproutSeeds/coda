import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type DurationUnit = "ms" | "s" | "m" | "h";
type DurationString = `${number} ${DurationUnit}`;

export const RATE_ACTIONS = [
  "mutation.global",
  "idea.create",
  "idea.publicize",
  "idea.export",
  "feature.create",
  "collaborator.invite",
  "join.request",
  "join.resolve",
] as const;

export type RateAction = (typeof RATE_ACTIONS)[number];

type TokenBucketInput = {
  refillRate: number;
  interval: DurationString;
  maxTokens: number;
};

type TokenBucketConfig = TokenBucketInput & { intervalMs: number };

type RatePlanId = "free" | "pro" | "team" | "default";

type PlanConfig = Record<RateAction, TokenBucketInput>;

type PlanOverrides = Partial<Record<RateAction, Partial<TokenBucketInput>>>;

const BASE_PLAN: PlanConfig = {
  "mutation.global": { refillRate: 120, interval: "1 m", maxTokens: 180 },
  "idea.create": { refillRate: 5, interval: "1 m", maxTokens: 8 },
  "idea.publicize": { refillRate: 3, interval: "10 m", maxTokens: 6 },
  "idea.export": { refillRate: 3, interval: "10 m", maxTokens: 5 },
  "feature.create": { refillRate: 24, interval: "1 m", maxTokens: 36 },
  "collaborator.invite": { refillRate: 6, interval: "30 m", maxTokens: 10 },
  "join.request": { refillRate: 8, interval: "30 m", maxTokens: 12 },
  "join.resolve": { refillRate: 10, interval: "30 m", maxTokens: 15 },
};

function applyOverrides(base: PlanConfig, overrides: PlanOverrides): PlanConfig {
  const next: Partial<PlanConfig> = {};
  for (const action of RATE_ACTIONS) {
    const baseConfig = base[action];
    const override = overrides[action];
    next[action] = override ? { ...baseConfig, ...override } : { ...baseConfig };
  }
  return next as PlanConfig;
}

const PLAN_RAW_CONFIG: Record<RatePlanId, PlanConfig> = {
  default: BASE_PLAN,
  free: applyOverrides(BASE_PLAN, {
    "mutation.global": { refillRate: 60, maxTokens: 90 },
    "idea.create": { refillRate: 3, maxTokens: 5 },
    "idea.publicize": { refillRate: 1, interval: "30 m", maxTokens: 2 },
    "idea.export": { refillRate: 1, interval: "30 m", maxTokens: 3 },
    "feature.create": { refillRate: 10, maxTokens: 15 },
    "collaborator.invite": { refillRate: 2, interval: "1 h", maxTokens: 4 },
    "join.request": { refillRate: 3, interval: "1 h", maxTokens: 4 },
    "join.resolve": { refillRate: 4, interval: "1 h", maxTokens: 6 },
  }),
  pro: applyOverrides(BASE_PLAN, {
    "mutation.global": { refillRate: 300, maxTokens: 360 },
    "idea.create": { refillRate: 15, maxTokens: 20 },
    "feature.create": { refillRate: 60, maxTokens: 80 },
    "collaborator.invite": { refillRate: 12, interval: "15 m", maxTokens: 20 },
    "join.request": { refillRate: 18, interval: "15 m", maxTokens: 24 },
    "join.resolve": { refillRate: 24, interval: "15 m", maxTokens: 30 },
  }),
  team: applyOverrides(BASE_PLAN, {
    "mutation.global": { refillRate: 600, maxTokens: 720 },
    "idea.create": { refillRate: 30, maxTokens: 40 },
    "idea.publicize": { refillRate: 8, interval: "5 m", maxTokens: 16 },
    "idea.export": { refillRate: 10, interval: "5 m", maxTokens: 18 },
    "feature.create": { refillRate: 150, maxTokens: 200 },
    "collaborator.invite": { refillRate: 24, interval: "10 m", maxTokens: 48 },
    "join.request": { refillRate: 30, interval: "10 m", maxTokens: 60 },
    "join.resolve": { refillRate: 40, interval: "10 m", maxTokens: 80 },
  }),
};

const DURATION_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};

function parseDuration(duration: DurationString) {
  const [rawValue, rawUnit] = duration.trim().split(/\s+/);
  const value = Number(rawValue);
  const unit = rawUnit as DurationUnit;
  const factor = DURATION_MS[unit];
  if (!Number.isFinite(value) || value <= 0 || !factor) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  return value * factor;
}

function resolvePlanId(planId?: string | null): RatePlanId {
  if (!planId) return "default";
  const normalized = planId.toLowerCase() as RatePlanId;
  if (normalized === "free" || normalized === "pro" || normalized === "team") {
    return normalized;
  }
  return "default";
}

function resolvePlanConfig(planId?: string | null): Record<RateAction, TokenBucketConfig> {
  const key = resolvePlanId(planId);
  const plan = PLAN_RAW_CONFIG[key] ?? PLAN_RAW_CONFIG.default;
  const result: Partial<Record<RateAction, TokenBucketConfig>> = {};
  for (const action of RATE_ACTIONS) {
    const config = plan[action] ?? PLAN_RAW_CONFIG.default[action];
    result[action] = { ...config, intervalMs: parseDuration(config.interval) };
  }
  return result as Record<RateAction, TokenBucketConfig>;
}

type RedisContext = {
  redis: Redis | null;
  prefix: string;
};

function resolveRedis(): RedisContext {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const prefix = process.env.UPSTASH_RATE_PREFIX ?? "coda:rate";
  if (!url || !token || /replace-with|sample/i.test(url + token)) {
    return { redis: null, prefix };
  }
  const existing = (globalThis as unknown as { __codaRateRedis?: Redis }).__codaRateRedis;
  if (existing) {
    return { redis: existing, prefix };
  }
  const redis = new Redis({ url, token });
  (globalThis as unknown as { __codaRateRedis?: Redis }).__codaRateRedis = redis;
  return { redis, prefix };
}

type UpstashCache = Map<string, Ratelimit>;

function getLimiterCache(): UpstashCache {
  const store = (globalThis as unknown as { __codaRateLimiterCache?: UpstashCache }).__codaRateLimiterCache;
  if (store) return store;
  const next: UpstashCache = new Map();
  (globalThis as unknown as { __codaRateLimiterCache?: UpstashCache }).__codaRateLimiterCache = next;
  return next;
}

type MemoryBucket = { tokens: number; lastRefill: number };

type MemoryStore = Map<string, Map<string, MemoryBucket>>;

function getMemoryStore(): MemoryStore {
  const store = (globalThis as unknown as { __codaRateMemoryStore?: MemoryStore }).__codaRateMemoryStore;
  if (store) return store;
  const next: MemoryStore = new Map();
  (globalThis as unknown as { __codaRateMemoryStore?: MemoryStore }).__codaRateMemoryStore = next;
  return next;
}

type RateLimitSource = "upstash" | "memory";

type BaseRateResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

export type RateLimiterResult = BaseRateResult & {
  limit: number;
  source: RateLimitSource;
};

export class RateLimitExceededError extends Error {
  constructor(public readonly result: RateLimiterResult, message?: string) {
    super(message ?? "Rate limit exceeded");
    this.name = "RateLimitExceededError";
  }
}

type ConsumeOptions = {
  action: RateAction;
  identifier: string;
  planId?: string | null;
  weight?: number;
};

function resolveLimiter(cacheKey: string, config: TokenBucketConfig) {
  const cache = getLimiterCache();
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  const { redis, prefix } = resolveRedis();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    prefix: `${prefix}:${cacheKey}`,
    limiter: Ratelimit.tokenBucket(config.refillRate, config.interval, config.maxTokens),
  });
  cache.set(cacheKey, limiter);
  return limiter;
}

function getMemoryBucket(cacheKey: string, identifier: string, config: TokenBucketConfig) {
  const store = getMemoryStore();
  if (!store.has(cacheKey)) {
    store.set(cacheKey, new Map());
  }
  const buckets = store.get(cacheKey)!;
  const existing = buckets.get(identifier);
  if (existing) return existing;
  const created: MemoryBucket = { tokens: config.maxTokens, lastRefill: Date.now() };
  buckets.set(identifier, created);
  return created;
}

function applyMemoryConsumption(cacheKey: string, identifier: string, weight: number, config: TokenBucketConfig, now: number) {
  const bucket = getMemoryBucket(cacheKey, identifier, config);
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const refillPerMs = config.refillRate / config.intervalMs;
    const tokensToAdd = refillPerMs * elapsed;
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= weight) {
    bucket.tokens -= weight;
    return {
      success: true,
      remaining: Math.max(0, Math.floor(bucket.tokens)),
      limit: config.maxTokens,
      reset: now + config.intervalMs,
      source: "memory" as RateLimitSource,
    };
  }

  const deficit = Math.max(0, weight - bucket.tokens);
  const refillPerMs = config.refillRate / config.intervalMs;
  const waitMs = refillPerMs > 0 ? Math.ceil(deficit / refillPerMs) : config.intervalMs;
  return {
    success: false,
    remaining: 0,
    limit: config.maxTokens,
    reset: now + waitMs,
    source: "memory" as RateLimitSource,
  };
}

export async function consumeRateLimit(options: ConsumeOptions): Promise<RateLimiterResult> {
  const { action, identifier, planId, weight = 1 } = options;
  if (weight <= 0) {
    throw new Error("Rate limit weight must be positive.");
  }

  const planConfig = resolvePlanConfig(planId);
  const config = planConfig[action];
  const planKey = resolvePlanId(planId);
  const cacheKey = `${planKey}:${action}`;
  const limiter = resolveLimiter(cacheKey, config);

  if (limiter) {
    try {
      const result = await limiter.limit(identifier, { rate: weight });
      return {
        success: result.success,
        remaining: Math.max(0, result.remaining),
        limit: result.limit,
        reset: typeof result.reset === "number" ? result.reset : Number(result.reset),
        source: "upstash",
      };
    } catch (error) {
      console.warn("Upstash rate limit failed, using in-memory fallback", { action, planId, error });
    }
  }

  return applyMemoryConsumption(cacheKey, identifier, weight, config, Date.now());
}

export async function enforceRateLimit(options: ConsumeOptions & { message?: string }) {
  const result = await consumeRateLimit(options);
  if (!result.success) {
    throw new RateLimitExceededError(result, options.message);
  }
  return result;
}
