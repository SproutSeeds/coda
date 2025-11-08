import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createManualLimitOverrideAction,
  getLimitInsightsAction,
  listPendingLimitOverridesAction,
  resolveLimitOverrideAction,
} from "@/app/dashboard/admin/limits/actions";

const {
  requirePlatformAdminMock,
  listPendingLimitOverridesMock,
  resolveLimitOverrideMock,
  getLimitEventSummaryMock,
  createManualLimitOverrideMock,
} = vi.hoisted(() => ({
  requirePlatformAdminMock: vi.fn(),
  listPendingLimitOverridesMock: vi.fn(),
  resolveLimitOverrideMock: vi.fn(),
  getLimitEventSummaryMock: vi.fn(),
  createManualLimitOverrideMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/admin", () => ({
  requirePlatformAdmin: requirePlatformAdminMock,
}));

vi.mock("@/lib/db/limits", () => ({
  listPendingLimitOverrides: listPendingLimitOverridesMock,
  resolveLimitOverride: resolveLimitOverrideMock,
  getLimitEventSummary: getLimitEventSummaryMock,
  createManualLimitOverride: createManualLimitOverrideMock,
  limitOverrideStatusEnum: { enumValues: ["pending", "approved", "rejected"] },
}));

describe("Admin limit override actions", () => {
  beforeEach(() => {
    requirePlatformAdminMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    listPendingLimitOverridesMock.mockReset();
    resolveLimitOverrideMock.mockReset();
    getLimitEventSummaryMock.mockReset();
    createManualLimitOverrideMock.mockReset();
  });

  it("lists pending overrides and serializes date fields", async () => {
    listPendingLimitOverridesMock.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        scopeType: "user",
        scopeId: "user-123",
        metric: "ideas.per_user.lifetime",
        limitValue: 10,
        planId: "free",
        reason: "special case",
        status: "pending",
        createdBy: "user-123",
        createdAt: new Date("2025-11-05T12:00:00.000Z"),
        updatedAt: new Date("2025-11-05T12:00:00.000Z"),
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
      },
    ]);

    const result = await listPendingLimitOverridesAction();

    expect(requirePlatformAdminMock).toHaveBeenCalled();
    expect(listPendingLimitOverridesMock).toHaveBeenCalledWith({ limit: undefined });
    expect(result).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        scopeType: "user",
        scopeId: "user-123",
        metric: "ideas.per_user.lifetime",
        limitValue: 10,
        planId: "free",
        reason: "special case",
        status: "pending",
        createdBy: "user-123",
        createdAt: "2025-11-05T12:00:00.000Z",
        updatedAt: "2025-11-05T12:00:00.000Z",
        expiresAt: "2026-01-01T00:00:00.000Z",
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
      },
    ]);
  });

  it("approves an override with validated payload", async () => {
    const overrideRecord = {
      id: "22222222-2222-4222-8222-222222222222",
      scopeType: "idea",
      scopeId: "idea-456",
      metric: "features.per_idea.lifetime",
      limitValue: 250,
      planId: null,
      reason: null,
      status: "approved",
      createdBy: "owner-1",
      createdAt: new Date("2025-11-06T10:00:00.000Z"),
      updatedAt: new Date("2025-11-06T10:30:00.000Z"),
      expiresAt: null,
      resolvedAt: new Date("2025-11-06T10:30:00.000Z"),
      resolvedBy: "admin-1",
      resolutionNote: "go ahead",
    };
    resolveLimitOverrideMock.mockResolvedValue(overrideRecord);

    const payload = {
      id: "22222222-2222-4222-8222-222222222222",
      decision: "approve" as const,
      limitValue: 250,
      expiresAt: "2026-05-01T00:00:00.000Z",
      reason: "launch partner",
      planId: "pro",
      resolutionNote: "go ahead",
    };

    const result = await resolveLimitOverrideAction(payload);

    expect(requirePlatformAdminMock).toHaveBeenCalled();
    expect(resolveLimitOverrideMock).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", {
      status: "approved",
      limitValue: 250,
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      reason: "launch partner",
      planId: "pro",
      resolutionNote: "go ahead",
      resolvedBy: "admin-1",
    });
    expect(result).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      scopeType: "idea",
      scopeId: "idea-456",
      metric: "features.per_idea.lifetime",
      limitValue: 250,
      planId: null,
      reason: null,
      status: "approved",
      createdBy: "owner-1",
      createdAt: "2025-11-06T10:00:00.000Z",
      updatedAt: "2025-11-06T10:30:00.000Z",
      expiresAt: null,
      resolvedAt: "2025-11-06T10:30:00.000Z",
      resolvedBy: "admin-1",
      resolutionNote: "go ahead",
    });
  });

  it("rejects an override without requiring limit value", async () => {
    const overrideRecord = {
      id: "33333333-3333-4333-8333-333333333333",
      scopeType: "user",
      scopeId: "user-789",
      metric: "mutations.per_user.daily",
      limitValue: 500,
      planId: "free",
      reason: "too frequent",
      status: "rejected",
      createdBy: "user-789",
      createdAt: new Date("2025-11-07T09:00:00.000Z"),
      updatedAt: new Date("2025-11-07T09:10:00.000Z"),
      expiresAt: null,
      resolvedAt: new Date("2025-11-07T09:10:00.000Z"),
      resolvedBy: "admin-1",
      resolutionNote: "Please upgrade",
    };
    resolveLimitOverrideMock.mockResolvedValue(overrideRecord);

    const result = await resolveLimitOverrideAction({
      id: "33333333-3333-4333-8333-333333333333",
      decision: "reject",
      resolutionNote: "Please upgrade",
    });

    expect(resolveLimitOverrideMock).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333", {
      status: "rejected",
      resolvedBy: "admin-1",
      resolutionNote: "Please upgrade",
    });
    expect(result.status).toBe("rejected");
  });

  it("throws when override resolution returns null", async () => {
    resolveLimitOverrideMock.mockResolvedValue(null);

    await expect(
      resolveLimitOverrideAction({ id: "44444444-4444-4444-8444-444444444444", decision: "reject" }),
    ).rejects.toThrow("Override not found");
  });

  it("validates required limit value on approval", async () => {
    await expect(
      resolveLimitOverrideAction({ id: "55555555-5555-4555-8555-555555555555", decision: "approve" }),
    ).rejects.toThrow(
      /positive limit value is required/i,
    );
    expect(resolveLimitOverrideMock).not.toHaveBeenCalled();
  });

  it("returns summarized limit insights", async () => {
    getLimitEventSummaryMock.mockResolvedValue([
      {
        metric: "mutations.per_user.daily",
        blocks24h: 1,
        warns24h: 3,
        blocks7d: 4,
        warns7d: 10,
        blocks30d: 12,
        warns30d: 40,
        lastBlockAt: new Date("2025-11-05T12:00:00.000Z"),
        lastWarnAt: new Date("2025-11-05T10:00:00.000Z"),
      },
    ]);

    const result = await getLimitInsightsAction();

    expect(requirePlatformAdminMock).toHaveBeenCalled();
    expect(getLimitEventSummaryMock).toHaveBeenCalled();
    expect(result).toEqual([
      {
        metric: "mutations.per_user.daily",
        blocks24h: 1,
        warns24h: 3,
        blocks7d: 4,
        warns7d: 10,
        blocks30d: 12,
        warns30d: 40,
        lastBlockAt: "2025-11-05T12:00:00.000Z",
        lastWarnAt: "2025-11-05T10:00:00.000Z",
      },
    ]);
  });

  it("creates manual overrides with sanitized payload", async () => {
    createManualLimitOverrideMock.mockResolvedValue({
      id: "override-999",
      scopeType: "idea",
      scopeId: "11111111-1111-4111-8111-111111111111",
      metric: "features.per_idea.lifetime",
      limitValue: 15,
      planId: null,
      reason: "allow hackathon",
      status: "approved",
      createdBy: "admin-1",
      createdAt: new Date("2025-11-05T12:00:00.000Z"),
      updatedAt: new Date("2025-11-05T12:00:00.000Z"),
      expiresAt: null,
      resolvedAt: new Date("2025-11-05T12:00:00.000Z"),
      resolvedBy: "admin-1",
      resolutionNote: "enjoy",
    });

    const result = await createManualLimitOverrideAction({
      scopeType: "idea",
      scopeId: "11111111-1111-4111-8111-111111111111",
      metric: "features.per_idea.lifetime",
      limitValue: 15,
      reason: "allow hackathon",
      resolutionNote: "enjoy",
      expiresAt: "2025-12-01T00:00:00.000Z",
      status: "approved",
    });

    expect(createManualLimitOverrideMock).toHaveBeenCalledWith({
      scopeType: "idea",
      scopeId: "11111111-1111-4111-8111-111111111111",
      metric: "features.per_idea.lifetime",
      limitValue: 15,
      planId: null,
      reason: "allow hackathon",
      resolutionNote: "enjoy",
      expiresAt: new Date("2025-12-01T00:00:00.000Z"),
      status: "approved",
      createdBy: "admin-1",
    });
    expect(result.id).toBe("override-999");
  });
});
