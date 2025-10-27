import { describe, expect, it, vi } from "vitest";

import { trackEvent } from "@/lib/utils/analytics";

vi.mock("@vercel/analytics/server", () => ({
  track: vi.fn(),
}));

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
  });

  it("supports events without additional properties", async () => {
    await trackEvent({ name: "idea_deleted" });

    const { track } = await import("@vercel/analytics/server");
    expect(track).toHaveBeenCalledWith("idea_deleted", {});
  });
});
