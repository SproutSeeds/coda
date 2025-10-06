import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "@/lib/utils/rate-limit";

describe("Rate limiting", () => {
  it("returns remaining requests when under the limit", async () => {
    const result = await consumeRateLimit("user-123");
    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("signals a throttled response when limit exceeded", async () => {
    const first = await consumeRateLimit("user-burst");
    expect(first.success).toBe(true);

    const second = await consumeRateLimit("user-burst");
    expect(second.success).toBe(false);
    expect(second.reset).toBeGreaterThan(Date.now());
  });
});
