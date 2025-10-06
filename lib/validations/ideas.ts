import { z } from "zod";

export type IdeaInput = {
  title: string;
  notes: string;
};

export type IdeaUpdateInput = Partial<IdeaInput> & { id: string };

const MAX_TITLE = 200;
const MAX_NOTES = 5000;

const ideaInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TITLE, `Title must be ≤ ${MAX_TITLE} characters`),
  notes: z
    .string()
    .min(1, "Notes are required")
    .max(MAX_NOTES, `Notes must be ≤ ${MAX_NOTES} characters`),
});

const ideaUpdateSchema = ideaInputSchema
  .partial()
  .extend({
    id: z.string().min(1, "Idea id is required"),
  })
  .refine((value) => value.title !== undefined || value.notes !== undefined, {
    message: "At least one field must be provided",
  });

const SCRIPT_TAG_REGEX = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

export function sanitizeIdeaNotes(notes: string): string {
  return notes.replace(SCRIPT_TAG_REGEX, "");
}

export function validateIdeaInput(input: IdeaInput): IdeaInput {
  const sanitized = {
    title: input.title.trim(),
    notes: sanitizeIdeaNotes(input.notes),
  };

  return ideaInputSchema.parse(sanitized);
}

export function validateIdeaUpdate(input: IdeaUpdateInput): IdeaUpdateInput {
  const sanitized = {
    ...input,
    title: input.title?.trim(),
    notes: input.notes !== undefined ? sanitizeIdeaNotes(input.notes) : undefined,
  };

  return ideaUpdateSchema.parse(sanitized);
}
