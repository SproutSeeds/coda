import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COST_MODEL } from "@/lib/pricing/cost-model";

const { listPlansMock, getCreditBalanceMock, getUserUsageSummaryMock } = vi.hoisted(() => ({
  listPlansMock: vi.fn(),
  getCreditBalanceMock: vi.fn(),
  getUserUsageSummaryMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/limits", () => ({
  listPlans: listPlansMock,
}));

vi.mock("@/lib/db/credits", () => ({
  getCreditBalance: getCreditBalanceMock,
  CREDIT_PRICE_USD_PER_UNIT: 0.05,
}));

vi.mock("@/lib/limits/summary", () => ({
  getUserUsageSummary: getUserUsageSummaryMock,
}));

const now = new Date("2025-01-01T00:00:00Z");

function buildPlan(id: string, name: string, isDefault: boolean) {
  return {
    id,
    name,
    description: null,
    isDefault,
    features: {},
    createdAt: now,
    updatedAt: now,
  } as unknown as import("@/lib/db/limits").PlanRecord;
}

beforeEach(() => {
  listPlansMock.mockResolvedValue([buildPlan("free", "Free", true), buildPlan("pro", "Pro", false)]);
  getCreditBalanceMock.mockResolvedValue({
    payer: { type: "user", id: "user-1" },
    available: 42,
    onHold: 0,
    autoTopUpEnabled: false,
    autoTopUpCredits: 0,
    autoTopUpThreshold: 0,
    autoTopUpPaymentMethodId: null,
    updatedAt: now,
  });
  getUserUsageSummaryMock.mockResolvedValue({
    plan: { id: "free", name: "Free" },
    metrics: [
      {
        metric: "ideas.per_user.lifetime",
        label: "Ideas",
        description: "",
        periodLabel: "Lifetime",
        count: 2,
        limit: 5,
        remaining: 3,
        status: "ok",
        warnThreshold: 4,
        progressPercent: 40,
      },
    ],
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("cost catalogue data", () => {
  it("builds a matrix of catalogue actions with plan limits", async () => {
    const { getCostCatalogueMatrix } = await import("@/lib/limits/catalogue");

    const matrix = await getCostCatalogueMatrix();

    expect(matrix.categories.length).toBeGreaterThan(0);
    expect(matrix.actions).toHaveLength(Object.keys(COST_MODEL).length);
    const ideaCreate = matrix.actions.find((action) => action.action === "idea.create");
    expect(ideaCreate).toBeDefined();
    expect(ideaCreate?.planLimits.find((limit) => limit.planId === "free")?.limit).toBeGreaterThan(0);
    expect(listPlansMock).toHaveBeenCalledTimes(1);
  });

  it("memoizes catalogue responses in memory cache", async () => {
    const { getCostCatalogueMatrix } = await import("@/lib/limits/catalogue");

    await getCostCatalogueMatrix();
    await getCostCatalogueMatrix();

    expect(listPlansMock).toHaveBeenCalledTimes(1);
  });

  it("resolves allowances with serialized credit timestamps", async () => {
    const { getCostCatalogueAllowances } = await import("@/lib/limits/catalogue");

    const snapshot = await getCostCatalogueAllowances("user-1");

    expect(getUserUsageSummaryMock).toHaveBeenCalledWith("user-1");
    expect(getCreditBalanceMock).toHaveBeenCalledWith({ type: "user", id: "user-1" });
    expect(snapshot.credits.updatedAtIso).toBe(now.toISOString());
    expect(snapshot.metricsById["ideas.per_user.lifetime"]).toBeDefined();
  });
});
