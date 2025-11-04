import { z } from "zod";

const joinRequestSchema = z.object({
  ideaId: z.string().min(1, "Idea is required"),
  message: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Tell the team how you want to help.")
    .refine((value) => value.length >= 20, "Share at least a couple of sentences.")
    .refine((value) => value.length <= 1000, "Keep your note under 1000 characters."),
});

const resolveJoinRequestSchema = z.object({
  requestId: z.string().min(1, "Request is required"),
  status: z.enum(["approved", "rejected"]),
  note: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z
      .string()
      .max(1000, "Keep your note under 1000 characters.")
      .nullable(),
  ).default(null),
  grantRole: z.enum(["editor", "commenter", "viewer"]).optional(),
});

const joinRequestReactionSchema = z.object({
  requestId: z.string().min(1, "Request is required"),
  reaction: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z
      .string()
      .max(32, "Reaction must be under 32 characters.")
      .nullable(),
  ),
});

const markJoinRequestsSeenSchema = z.object({
  ideaId: z.string().min(1, "Idea is required"),
  requestIds: z.array(z.string().min(1)).optional(),
});

export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type ResolveJoinRequestValidationInput = z.infer<typeof resolveJoinRequestSchema>;
export type ResolveJoinRequestActionInput = {
  requestId: string;
  status: "approved" | "rejected";
  note?: string | null;
  grantRole?: "editor" | "commenter" | "viewer";
};
export type JoinRequestReactionInput = z.infer<typeof joinRequestReactionSchema>;
export type MarkJoinRequestsSeenInput = z.infer<typeof markJoinRequestsSeenSchema>;

export function validateJoinRequestInput(input: JoinRequestInput) {
  return joinRequestSchema.parse(input);
}

export function validateResolveJoinRequestInput(input: ResolveJoinRequestActionInput) {
  return resolveJoinRequestSchema.parse(input);
}

export function validateJoinRequestReactionInput(input: JoinRequestReactionInput) {
  return joinRequestReactionSchema.parse(input);
}

export function validateMarkJoinRequestsSeenInput(input: MarkJoinRequestsSeenInput) {
  return markJoinRequestsSeenSchema.parse(input);
}
