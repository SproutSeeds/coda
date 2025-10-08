import { z } from "zod";

import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";

export type IdeaInput = {
  title: string;
  notes: string;
};

export type IdeaUpdateInput = Partial<IdeaInput> & { id: string };
export type IdeaReorderInput = string[];

const MAX_TITLE = 200;
const ideaNotesCharacterLimit = IDEA_NOTES_CHARACTER_LIMIT;

const ideaInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TITLE, `Title must be ≤ ${MAX_TITLE} characters`),
  notes: z
    .string()
    .min(1, "Notes are required"),
});

const ideaUpdateSchema = ideaInputSchema
  .partial()
  .extend({
    id: z.string().min(1, "Idea id is required"),
  })
  .refine((value) => value.title !== undefined || value.notes !== undefined, {
    message: "At least one field must be provided",
  });

const ideaReorderSchema = z
  .array(z.string().min(1, "Idea id is required"))
  .min(1, "Provide at least one idea id")
  .refine((value) => new Set(value).size === value.length, {
    message: "Idea ids must be unique",
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
  if (sanitized.notes.length > ideaNotesCharacterLimit) {
    throw new Error(`Notes must be ≤ ${ideaNotesCharacterLimit} characters`);
  }

  return ideaInputSchema.parse(sanitized);
}

export function validateIdeaUpdate(input: IdeaUpdateInput): IdeaUpdateInput {
  const sanitized = {
    ...input,
    title: input.title?.trim(),
    notes: input.notes !== undefined ? sanitizeIdeaNotes(input.notes) : undefined,
  };

  if (sanitized.notes !== undefined && sanitized.notes.length > ideaNotesCharacterLimit) {
    throw new Error(`Notes must be ≤ ${ideaNotesCharacterLimit} characters`);
  }

  return ideaUpdateSchema.parse(sanitized);
}

export function validateIdeaReorder(ids: IdeaReorderInput): string[] {
  return ideaReorderSchema.parse(ids);
}
