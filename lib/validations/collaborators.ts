import { z } from "zod";

const ROLE_VALUES = ["editor", "commenter", "viewer"] as const;

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(320, "Email is too long");

const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLE_VALUES),
});

const directoryLookupSchema = z.object({
  ideaId: z.string().min(1, "Idea is required"),
  query: z.string().trim().min(1, "Search term is required").max(256, "Search is too long"),
  limit: z.number().int().positive().max(20).optional(),
});

const roleSchema = z.object({
  role: z.enum(ROLE_VALUES),
});

export type CollaboratorInviteInput = {
  email: string;
  role: (typeof ROLE_VALUES)[number];
};

export type CollaboratorRoleChangeInput = {
  role: (typeof ROLE_VALUES)[number];
};

export type CollaboratorDirectoryLookupInput = z.infer<typeof directoryLookupSchema>;

export function normalizeCollaboratorEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateCollaboratorInviteInput(input: CollaboratorInviteInput) {
  const normalized = {
    email: normalizeCollaboratorEmail(input.email),
    role: input.role,
  };
  return inviteSchema.parse(normalized);
}

export function validateCollaboratorRoleChange(input: CollaboratorRoleChangeInput) {
  return roleSchema.parse({ role: input.role });
}

export function validateCollaboratorDirectoryLookup(input: CollaboratorDirectoryLookupInput) {
  return directoryLookupSchema.parse(input);
}
