import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderAdapter } from "@/lib/providers/types";
import { syncProviderCosts } from "@/lib/usage/provider-ledger";

const {
  recordProviderCostEventsMock,
  upsertProviderCostSnapshotMock,
  createProviderReconciliationMock,
} = vi.hoisted(() => ({
  recordProviderCostEventsMock: vi.fn(),
  upsertProviderCostSnapshotMock: vi.fn(),
  createProviderReconciliationMock: vi.fn(),
}));

vi.mock("@/lib/db/provider-costs", () => ({
  recordProviderCostEvents: recordProviderCostEventsMock,
  upsertProviderCostSnapshot: upsertProviderCostSnapshotMock,
  createProviderReconciliation: createProviderReconciliationMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({}),
}));

describe("syncProviderCosts", () => {
  const now = new Date("2025-01-15T12:00:00.000Z");

  beforeEach(() => {
    recordProviderCostEventsMock.mockReset();
    upsertProviderCostSnapshotMock.mockReset();
    createProviderReconciliationMock.mockReset();

    recordProviderCostEventsMock.mockResolvedValue(undefined);
    upsertProviderCostSnapshotMock.mockResolvedValue(undefined);
  });

  it("persists snapshots, events, and reconciliation for adapter results", async () => {
    createProviderReconciliationMock.mockResolvedValue({
      providerQuantity: 10,
      providerCostUsd: 2.5,
      internalQuantity: 8,
      internalCostUsd: 2,
      varianceUsd: 0.5,
      varianceRatio: 0.25,
    });

    const adapter: ProviderAdapter = {
      id: "neon_postgres",
      label: "Neon Test",
      async collect(context) {
        return [
          {
            provider: "neon_postgres",
            metric: "storage",
            windowStart: context.windowStart,
            windowEnd: context.windowEnd,
            quantity: 10,
            costUsd: 2.5,
            currency: "usd",
            metadata: { sample: true },
          },
        ];
      },
    };

    const results = await syncProviderCosts({ adapters: [adapter], window: "day", now });

    expect(recordProviderCostEventsMock).toHaveBeenCalledTimes(1);
    const [, events] = recordProviderCostEventsMock.mock.calls[0];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      provider: "neon_postgres",
      metric: "storage",
      costUsd: 2.5,
    });

    expect(upsertProviderCostSnapshotMock).toHaveBeenCalledWith(expect.any(Object), {
      provider: "neon_postgres",
      metric: "storage",
      window: "day",
      quantity: 10,
      costUsd: 2.5,
      currency: "usd",
      metadata: { sample: true },
      windowStart: expect.any(Date),
      windowEnd: expect.any(Date),
      sampleCount: 1,
    });

    expect(createProviderReconciliationMock).toHaveBeenCalledWith(expect.any(Object), {
      provider: "neon_postgres",
      metric: "storage",
      window: "day",
      providerQuantity: 10,
      providerCostUsd: 2.5,
      windowStart: expect.any(Date),
      windowEnd: expect.any(Date),
      metadata: { sample: true },
    });

    expect(results).toEqual([
      {
        provider: "neon_postgres",
        metric: "storage",
        quantity: 10,
        costUsd: 2.5,
        varianceUsd: 0.5,
        varianceRatio: 0.25,
      },
    ]);
  });

  it("returns empty array when adapters yield no data", async () => {
    const adapter: ProviderAdapter = {
      id: "vercel_analytics",
      label: "Empty",
      async collect() {
        return [];
      },
    };

    const results = await syncProviderCosts({ adapters: [adapter], window: "day", now });
    expect(results).toEqual([]);
    expect(recordProviderCostEventsMock).not.toHaveBeenCalled();
  });
});
