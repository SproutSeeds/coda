import { z } from "zod";

import { LIMIT_METRICS } from "@/lib/limits/types";
import type { LimitOverrideStatus } from "@/lib/db/limits";

const MAX_REASON_LENGTH = 512;
const MAX_NOTE_LENGTH = 1024;

export const limitMetricSchema = z.enum(LIMIT_METRICS);

const baseOverrideSchema = z.object({
  id: z.string().uuid(),
});

export const resolveLimitOverrideSchema = baseOverrideSchema.extend({
  decision: z.enum(["approve", "reject"]),
  limitValue: z.number().int().nonnegative().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  reason: z.string().max(MAX_REASON_LENGTH).optional().nullable(),
  planId: z.string().min(1).max(64).optional().nullable(),
  resolutionNote: z.string().max(MAX_NOTE_LENGTH).optional().nullable(),
});

export type ResolveLimitOverrideInput = z.infer<typeof resolveLimitOverrideSchema>;

export function validateResolveLimitOverrideInput(input: unknown) {
  const parsed = resolveLimitOverrideSchema.safeParse(input);
  if (!parsed.success) {
    throw parsed.error;
  }

  if (parsed.data.decision === "approve") {
    if (typeof parsed.data.limitValue !== "number" || parsed.data.limitValue <= 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "A positive limit value is required to approve an override.",
          path: ["limitValue"],
        },
      ]);
    }
  }

  return parsed.data;
}

export const createLimitOverrideRequestSchema = z.object({
  scopeType: z.enum(["user", "idea", "org"]),
  scopeId: z.string().uuid(),
  metric: limitMetricSchema,
  limitValue: z.number().int().nonnegative(),
  reason: z.string().max(MAX_REASON_LENGTH).optional().nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  planId: z.string().min(1).max(64).optional().nullable(),
});

export type CreateLimitOverrideRequestInput = z.infer<typeof createLimitOverrideRequestSchema>;

export const createManualLimitOverrideSchema = createLimitOverrideRequestSchema.extend({
  limitValue: z.number().int().positive(),
  resolutionNote: z.string().max(MAX_NOTE_LENGTH).optional().nullable(),
  status: z.enum(["approved", "rejected"]).optional(),
});

export type CreateManualLimitOverrideInput = z.infer<typeof createManualLimitOverrideSchema>;

export function toOverrideStatus(decision: "approve" | "reject"): Extract<LimitOverrideStatus, "approved" | "rejected"> {
  return decision === "approve" ? "approved" : "rejected";
}
