import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 5_000;
const LIMIT = 1;

const store = new Map<string, { remaining: number; reset: number }>();

let upstashLimiter: Ratelimit | null = null;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

function resolveLimiter() {
  if (upstashLimiter) return upstashLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const looksLikePlaceholder = [url, token].some((value) => /replace-with|sample/i.test(value));
  if (looksLikePlaceholder) {
    return null;
  }

  upstashLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(LIMIT, `${WINDOW_MS} ms`),
  });
  return upstashLimiter;
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
