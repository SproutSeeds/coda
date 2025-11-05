"use server";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  createManualLimitOverride,
  getLimitEventSummary,
  listPendingLimitOverrides,
  resolveLimitOverride,
  type LimitEventSummary,
  type LimitOverrideRecord,
  type LimitOverrideStatus,
} from "@/lib/db/limits";
import {
  createManualLimitOverrideSchema,
  toOverrideStatus,
  validateResolveLimitOverrideInput,
} from "@/lib/validations/limits";

export type SerializableOverride = ReturnType<typeof serializeOverride>;

function serializeOverride(override: LimitOverrideRecord): {
  id: string;
  scopeType: LimitOverrideRecord["scopeType"];
  scopeId: string;
  metric: string;
  limitValue: number;
  planId: string | null;
  reason: string | null;
  status: LimitOverrideStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
} {
  return {
    id: override.id,
    scopeType: override.scopeType,
    scopeId: override.scopeId,
    metric: override.metric,
    limitValue: override.limitValue,
    planId: override.planId,
    reason: override.reason,
    status: override.status,
    createdBy: override.createdBy,
    createdAt: override.createdAt?.toISOString?.() ?? new Date(override.createdAt).toISOString(),
    updatedAt: override.updatedAt?.toISOString?.() ?? new Date(override.updatedAt).toISOString(),
    expiresAt: override.expiresAt ? override.expiresAt.toISOString() : null,
    resolvedAt: override.resolvedAt ? override.resolvedAt.toISOString() : null,
    resolvedBy: override.resolvedBy ?? null,
    resolutionNote: override.resolutionNote ?? null,
  };
}

export async function listPendingLimitOverridesAction(input?: { limit?: number }): Promise<SerializableOverride[]> {
  await requirePlatformAdmin();
  const limit =
    typeof input?.limit === "number" && Number.isFinite(input.limit) && input.limit > 0 ? Math.floor(input.limit) : undefined;
  const overrides = await listPendingLimitOverrides({ limit });
  return overrides.map(serializeOverride);
}

export async function resolveLimitOverrideAction(payload: unknown): Promise<SerializableOverride> {
  const admin = await requirePlatformAdmin();
  const input = validateResolveLimitOverrideInput(payload);
  const status = toOverrideStatus(input.decision);
  const expiresAt =
    input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null;

  const record = await resolveLimitOverride(input.id, {
    status,
    limitValue: input.decision === "approve" ? input.limitValue : undefined,
    expiresAt,
    reason: input.reason === undefined ? undefined : input.reason ?? null,
    planId: input.planId === undefined ? undefined : input.planId ?? null,
    resolutionNote: input.resolutionNote === undefined ? undefined : input.resolutionNote ?? null,
    resolvedBy: admin.id,
  });

  if (!record) {
    throw new Error("Override not found");
  }
  return serializeOverride(record);
}

export type SerializableLimitEventSummary = {
  metric: string;
  blocks24h: number;
  warns24h: number;
  blocks7d: number;
  warns7d: number;
  blocks30d: number;
  warns30d: number;
  lastBlockAt: string | null;
  lastWarnAt: string | null;
};

function serializeLimitSummary(summary: LimitEventSummary): SerializableLimitEventSummary {
  return {
    metric: summary.metric,
    blocks24h: summary.blocks24h,
    warns24h: summary.warns24h,
    blocks7d: summary.blocks7d,
    warns7d: summary.warns7d,
    blocks30d: summary.blocks30d,
    warns30d: summary.warns30d,
    lastBlockAt: summary.lastBlockAt ? summary.lastBlockAt.toISOString() : null,
    lastWarnAt: summary.lastWarnAt ? summary.lastWarnAt.toISOString() : null,
  };
}

export async function getLimitInsightsAction(): Promise<SerializableLimitEventSummary[]> {
  await requirePlatformAdmin();
  const insights = await getLimitEventSummary();
  return insights.map(serializeLimitSummary);
}

export async function createManualLimitOverrideAction(payload: unknown): Promise<SerializableOverride> {
  const admin = await requirePlatformAdmin();
  const parsed = createManualLimitOverrideSchema.parse(payload);

  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  const record = await createManualLimitOverride({
    scopeType: parsed.scopeType,
    scopeId: parsed.scopeId,
    metric: parsed.metric,
    limitValue: parsed.limitValue,
    planId: parsed.planId ?? null,
    reason: parsed.reason ?? null,
    resolutionNote: parsed.resolutionNote ?? null,
    expiresAt,
    status: parsed.status === "rejected" ? "rejected" : "approved",
    createdBy: admin.id,
  });

  if (!record) {
    throw new Error("Unable to create limit override");
  }

  return serializeOverride(record);
}
