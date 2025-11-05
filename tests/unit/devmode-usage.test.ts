import { describe, expect, it, vi } from "vitest";

import { logUsageCostsForSession } from "@/lib/devmode/usage";

const { logUsageCostMock } = vi.hoisted(() => ({
  logUsageCostMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/usage/log-cost", () => ({
  logUsageCost: logUsageCostMock,
}));

vi.mock("@/lib/limits/payer", () => ({
  actorPays: (id: string, metadata?: Record<string, unknown>) => ({
    primary: { type: "user" as const, id },
    fallback: null,
    strategy: "actor" as const,
    metadata,
  }),
  workspaceCovers: (workspaceId: string, fallbackUserId?: string | null, metadata?: Record<string, unknown>) => ({
    primary: { type: "workspace" as const, id: workspaceId },
    fallback: fallbackUserId ? { type: "user" as const, id: fallbackUserId } : null,
    strategy: fallbackUserId ? ("shared" as const) : ("workspace" as const),
    metadata,
  }),
}));

describe("logUsageCostsForSession", () => {
  it("logs both minutes and bytes when usage is present", async () => {
    logUsageCostMock.mockClear();
    const usage = {
      jobId: "job-1",
      ideaId: "idea-1",
      userId: "user-1",
      payerType: "user",
      payerId: "user-1",
      runnerId: "runner-123",
      durationMs: 180000,
      logBytes: 4096,
      costLoggedAt: null,
    } as unknown as Parameters<typeof logUsageCostsForSession>[0];

    const logged = await logUsageCostsForSession(usage);

    expect(logged).toBe(true);
    expect(logUsageCostMock).toHaveBeenCalledTimes(2);
    expect(logUsageCostMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "devmode.minute",
        quantity: 3,
        metadata: expect.objectContaining({
          jobId: "job-1",
          ideaId: "idea-1",
          runnerId: "runner-123",
          durationMs: 180000,
        }),
      }),
    );
    expect(logUsageCostMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "devmode.byte",
        quantity: 4096,
        metadata: expect.objectContaining({
          jobId: "job-1",
          ideaId: "idea-1",
          runnerId: "runner-123",
          bytes: 4096,
        }),
      }),
    );
  });

  it("skips logging when there is no usage", async () => {
    logUsageCostMock.mockClear();
    const usage = {
      jobId: "job-2",
      ideaId: "idea-2",
      userId: "user-2",
      payerType: "user",
      payerId: "user-2",
      runnerId: null,
      durationMs: 0,
      logBytes: 0,
      costLoggedAt: null,
    } as unknown as Parameters<typeof logUsageCostsForSession>[0];

    const logged = await logUsageCostsForSession(usage);

    expect(logged).toBe(false);
    expect(logUsageCostMock).not.toHaveBeenCalled();
  });
});
