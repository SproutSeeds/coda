import { z } from "zod";

export const creditTopUpRequestSchema = z.object({
  credits: z.number().positive("Select a credit amount greater than zero.").max(1_000_000, "Credit amount too large."),
  provider: z.string().min(1, "Provider is required."),
  amountUsd: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreditTopUpRequestInput = z.infer<typeof creditTopUpRequestSchema>;

export const creditTopUpFinalizeSchema = z.object({
  purchaseId: z.string().uuid("Purchase identifier must be a UUID."),
  providerReference: z.string().min(1).optional(),
  referenceCredits: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreditTopUpFinalizeInput = z.infer<typeof creditTopUpFinalizeSchema>;

export const autoTopUpSettingsSchema = z.object({
  enabled: z.boolean(),
  credits: z.number().nonnegative().optional(),
  threshold: z.number().nonnegative().optional(),
  paymentMethodId: z.string().min(1).optional().nullable(),
});

export type AutoTopUpSettingsInput = z.infer<typeof autoTopUpSettingsSchema>;
