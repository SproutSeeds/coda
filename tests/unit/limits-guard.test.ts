import { describe, expect, it, vi, beforeEach } from "vitest";

import { checkAndConsumeLimit } from "@/lib/limits/guard";
import { getUsageCounter, incrementUsageCounter, listLimitOverrides, writeLimitEvent } from "@/lib/db/limits";
import { chargeCredits } from "@/lib/db/credits";

vi.mock("@/lib/db/limits", () => {
  return {
    assignUserPlan: vi.fn(),
    getDefaultPlan: vi.fn().mockResolvedValue({ id: "free", name: "Free", features: {} }),
    getUserPlan: vi.fn().mockResolvedValue(null),
    listLimitOverrides: vi.fn().mockResolvedValue([]),
    getUsageCounter: vi.fn().mockResolvedValue({ count: 0 }),
    incrementUsageCounter: vi.fn().mockResolvedValue(undefined),
    writeLimitEvent: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/db/credits", () => ({
  chargeCredits: vi.fn().mockResolvedValue(undefined),
}));

describe("Limit guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUsageCounter).mockResolvedValue({ count: 0 });
    vi.mocked(listLimitOverrides).mockResolvedValue([]);
    vi.mocked(chargeCredits).mockResolvedValue(undefined);
  });

  it("allows increments when under the limit", async () => {
    const result = await checkAndConsumeLimit({
      scope: { type: "user", id: "user-1" },
      metric: "ideas.per_user.lifetime",
      increment: 1,
      userId: "user-1",
    });

    expect(result.mode).toBe("ok");
    expect(result.count).toBe(1);
    expect(incrementUsageCounter).toHaveBeenCalled();
  });

  it("warns as usage nears the threshold", async () => {
    vi.mocked(getUsageCounter).mockResolvedValueOnce({ count: 3 });

    const result = await checkAndConsumeLimit({
      scope: { type: "user", id: "user-1" },
      metric: "ideas.per_user.lifetime",
      increment: 1,
      userId: "user-1",
    });

    expect(result.mode).toBe("warn");
    expect(writeLimitEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "warn" }));
  });

  it("blocks when exceeding the hard limit", async () => {
    vi.mocked(getUsageCounter).mockResolvedValueOnce({ count: 5 });

    const result = await checkAndConsumeLimit({
      scope: { type: "user", id: "user-1" },
      metric: "ideas.per_user.lifetime",
      increment: 1,
      userId: "user-1",
    });

    expect(result.mode).toBe("blocked");
    expect(writeLimitEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "block" }));
    expect(incrementUsageCounter).not.toHaveBeenCalled();
  });

  it("applies an active override when calculating limits", async () => {
    vi.mocked(listLimitOverrides).mockResolvedValueOnce([
      {
        id: "override-1",
        scopeType: "user",
        scopeId: "user-1",
        metric: "ideas.per_user.lifetime",
        limitValue: 25,
        planId: null,
        reason: null,
        status: "approved",
        createdBy: "admin-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        resolvedAt: new Date(),
        resolvedBy: "admin-1",
        resolutionNote: null,
      },
    ]);
    vi.mocked(getUsageCounter).mockResolvedValueOnce({ count: 20 });

    const result = await checkAndConsumeLimit({
      scope: { type: "user", id: "user-1" },
      metric: "ideas.per_user.lifetime",
      increment: 1,
      userId: "user-1",
    });

    expect(result.mode).toBe("warn");
    expect(result.overrideId).toBe("override-1");
    expect(result.limit).toBe(25);
    expect(incrementUsageCounter).toHaveBeenCalledWith(expect.objectContaining({ increment: 1 }));
  });

  it("charges credits when a credit payload is provided", async () => {
    vi.mocked(getUsageCounter).mockResolvedValueOnce({ count: 4 });

    const result = await checkAndConsumeLimit({
      scope: { type: "user", id: "user-2" },
      metric: "mutations.per_user.daily",
      increment: 1,
      userId: "user-2",
      credit: {
        amount: 2,
        allowDebt: false,
      },
    });

    expect(result.credit?.amount).toBe(2);
    expect(chargeCredits).toHaveBeenCalledWith(expect.objectContaining({
      amount: 2,
      source: "mutations.per_user.daily",
    }));
  });
});
