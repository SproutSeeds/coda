import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "@/lib/utils/analytics";

vi.mock("@vercel/analytics/server", () => ({
  track: vi.fn(),
}));

const { logUsageCostMock } = vi.hoisted(() => ({
  logUsageCostMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/usage/log-cost", () => ({
  logUsageCost: logUsageCostMock,
}));

beforeEach(() => {
  logUsageCostMock.mockClear();
});

describe("Analytics instrumentation", () => {
  it("emits idea_* events with metadata", async () => {
    await trackEvent({
      name: "idea_created",
      properties: { ideaId: "idea-1", latencyMs: 120 },
    });

    const { track } = await import("@vercel/analytics/server");
    expect(track).toHaveBeenCalledWith("idea_created", {
      ideaId: "idea-1",
      latencyMs: 120,
    });
    expect(logUsageCostMock).toHaveBeenCalledWith({
      payerType: "workspace",
      payerId: "analytics:global",
      action: "analytics.event",
      metadata: { event: "idea_created", hasUserId: false },
    });
  });

  it("supports events without additional properties", async () => {
    await trackEvent({ name: "idea_deleted" });

    const { track } = await import("@vercel/analytics/server");
    expect(track).toHaveBeenCalledWith("idea_deleted", {});
    expect(logUsageCostMock).toHaveBeenCalledWith({
      payerType: "workspace",
      payerId: "analytics:global",
      action: "analytics.event",
      metadata: { event: "idea_deleted", hasUserId: false },
    });
  });
});
