import { z } from "zod";

import { IDEA_NOTES_CHARACTER_LIMIT } from "@/lib/constants/ideas";

export type IdeaInput = {
  title: string;
  notes: string;
  githubUrl?: string | null;
  linkLabel?: string | null;
  visibility?: "private" | "public";
};

export type IdeaUpdateInput = Partial<IdeaInput> & { id: string };
export type IdeaReorderInput = string[];

const MAX_TITLE = 255;
const MAX_LINK_LABEL = 120;
const ideaNotesCharacterLimit = IDEA_NOTES_CHARACTER_LIMIT;

const ideaInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TITLE, `Title must be ≤ ${MAX_TITLE} characters`),
  notes: z
    .string()
    .refine((value) => value.trim().length > 0, "Notes are required"),
  githubUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(2048, "Link is too long")
    .nullable()
    .optional(),
  linkLabel: z
    .string()
    .trim()
    .min(1, "Link title is required")
    .max(MAX_LINK_LABEL, `Link title must be ≤ ${MAX_LINK_LABEL} characters`)
    .optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

const ideaUpdateSchema = ideaInputSchema
  .partial()
  .extend({
    id: z.string().min(1, "Idea id is required"),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.notes !== undefined ||
      value.githubUrl !== undefined ||
      value.linkLabel !== undefined ||
      value.visibility !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

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
    githubUrl: input.githubUrl === undefined || input.githubUrl === null || input.githubUrl.trim() === ""
      ? null
      : input.githubUrl.trim(),
    linkLabel:
      input.linkLabel === undefined || input.linkLabel === null || input.linkLabel.trim() === ""
        ? undefined
        : input.linkLabel.trim(),
    visibility: input.visibility,
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
    githubUrl:
      input.githubUrl === undefined
        ? undefined
        : input.githubUrl === null || input.githubUrl.trim() === ""
          ? null
          : input.githubUrl.trim(),
    linkLabel:
      input.linkLabel === undefined
        ? undefined
        : input.linkLabel === null || input.linkLabel.trim() === ""
          ? undefined
          : input.linkLabel.trim(),
    visibility: input.visibility,
  };

  if (sanitized.notes !== undefined && sanitized.notes.length > ideaNotesCharacterLimit) {
    throw new Error(`Notes must be ≤ ${ideaNotesCharacterLimit} characters`);
  }

  return ideaUpdateSchema.parse(sanitized);
}

export function validateIdeaReorder(ids: IdeaReorderInput): string[] {
  return ideaReorderSchema.parse(ids);
}
