import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 5_000;
const LIMIT = 1;

const globalStore = (globalThis as unknown as {
  __codaRateLimitStore?: Map<string, { remaining: number; reset: number }>;
}).__codaRateLimitStore;

const store = globalStore ?? new Map<string, { remaining: number; reset: number }>();

(globalThis as unknown as {
  __codaRateLimitStore?: Map<string, { remaining: number; reset: number }>;
}).__codaRateLimitStore = store;

let upstashLimiter: Ratelimit | null = null;
const upstashLimiterCache = new Map<string, Ratelimit>();

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const looksLikePlaceholder = [url, token].some((value) => /replace-with|sample/i.test(value));
  if (looksLikePlaceholder) {
    return null;
  }
  return new Redis({ url, token });
}

function resolveLimiter() {
  if (upstashLimiter) return upstashLimiter;
  const redis = getRedisClient();
  if (!redis) return null;

  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(LIMIT, `${WINDOW_MS} ms`),
  });
  return upstashLimiter;
}

function resolveConfiguredLimiter(config: RateLimitConfig): Ratelimit | null {
  const cacheKey = `${config.limit}:${config.windowMs}`;
  const cached = upstashLimiterCache.get(cacheKey);
  if (cached) return cached;

  const redis = getRedisClient();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(config.limit, `${config.windowMs} ms`),
  });
  upstashLimiterCache.set(cacheKey, limiter);
  return limiter;
}

export async function consumeRateLimit(key: string): Promise<RateLimitResult> {
  const limiter = resolveLimiter();
  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(key);
      const resetMs = typeof reset === "number" ? reset : Number(reset);
      return { success, remaining: success ? remaining : 0, reset: resetMs };
    } catch (error) {
      console.warn("Upstash rate limit unavailable, using in-memory fallback", error);
    }
  }

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.reset <= now) {
    const next = { remaining: LIMIT - 1, reset: now + WINDOW_MS };
    store.set(key, next);
    return { success: true, remaining: next.remaining, reset: next.reset };
  }

  if (entry.remaining > 0) {
    entry.remaining -= 1;
    return { success: true, remaining: entry.remaining, reset: entry.reset };
  }

  return { success: false, remaining: 0, reset: entry.reset };
}

export function resetRateLimitStore() {
  store.clear();
}

/**
 * Consume a rate limit with custom configuration.
 * @param key - Unique key for the rate limit (e.g., "billing:refund:{userId}")
 * @param config - Rate limit configuration with limit and windowMs
 */
export async function consumeConfiguredRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = resolveConfiguredLimiter(config);
  if (limiter) {
    try {
      const { success, remaining, reset } = await limiter.limit(key);
      const resetMs = typeof reset === "number" ? reset : Number(reset);
      return { success, remaining: success ? remaining : 0, reset: resetMs };
    } catch (error) {
      console.warn("Upstash rate limit unavailable, using in-memory fallback", error);
    }
  }

  // In-memory fallback with custom config
  const now = Date.now();
  const configuredKey = `${key}:${config.limit}:${config.windowMs}`;
  const entry = store.get(configuredKey);

  if (!entry || entry.reset <= now) {
    const next = { remaining: config.limit - 1, reset: now + config.windowMs };
    store.set(configuredKey, next);
    return { success: true, remaining: next.remaining, reset: next.reset };
  }

  if (entry.remaining > 0) {
    entry.remaining -= 1;
    return { success: true, remaining: entry.remaining, reset: entry.reset };
  }

  return { success: false, remaining: 0, reset: entry.reset };
}

// Pre-configured rate limits for billing actions
export const BILLING_RATE_LIMITS = {
  requestRefund: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  selfServiceRefund: { limit: 1, windowMs: 24 * 60 * 60 * 1000 }, // 1 per day
  sendGift: { limit: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 per day
  subscribe: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  upgradeToAnnual: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  cancelScheduledUpgrade: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  // Aggressive throttle for cancel/renew toggles to prevent rapid state changes
  subscriptionToggle: { limit: 3, windowMs: 60 * 1000 }, // 3 per minute - then 10s cooldown
} as const;
