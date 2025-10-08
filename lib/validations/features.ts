import { z } from "zod";

export type FeatureInput = {
  ideaId: string;
  title: string;
  notes: string;
};

export type FeatureUpdateInput = Partial<Omit<FeatureInput, "ideaId">> & { id: string; ideaId: string };

const MAX_TITLE = 200;
const MAX_NOTES = 5000;

const featureInputSchema = z.object({
  ideaId: z.string().min(1, "Idea id is required"),
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

const featureUpdateSchema = featureInputSchema
  .omit({ ideaId: true })
  .partial()
  .extend({
    id: z.string().min(1, "Feature id is required"),
    ideaId: z.string().min(1, "Idea id is required"),
  })
  .refine((value) => value.title !== undefined || value.notes !== undefined, {
    message: "Provide a title or notes update",
  });

export function sanitizeFeatureNotes(notes: string): string {
  return notes.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export function validateFeatureInput(input: FeatureInput): FeatureInput {
  const sanitized = {
    ideaId: input.ideaId.trim(),
    title: input.title.trim(),
    notes: sanitizeFeatureNotes(input.notes),
  };
  return featureInputSchema.parse(sanitized);
}

export function validateFeatureUpdate(input: FeatureUpdateInput): FeatureUpdateInput {
  const sanitized = {
    ...input,
    title: input.title?.trim(),
    notes: input.notes !== undefined ? sanitizeFeatureNotes(input.notes) : undefined,
  };
  return featureUpdateSchema.parse(sanitized);
}
