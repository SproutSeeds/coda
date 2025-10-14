import { z } from "zod";

export type FeatureInput = {
  ideaId: string;
  title: string;
  notes: string;
  starred?: boolean;
  detail?: string;
  detailLabel?: string;
};

export type FeatureUpdateInput = Partial<Omit<FeatureInput, "ideaId">> & { id: string; ideaId: string };

const MAX_TITLE = 255;
const MAX_NOTES = 10_000;
const MAX_DETAIL = 10_000;
const MAX_DETAIL_LABEL = 60;

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
  starred: z.boolean().optional().default(false),
  detail: z
    .string()
    .max(MAX_DETAIL, `Detail must be ≤ ${MAX_DETAIL} characters`)
    .default(""),
  detailLabel: z
    .string()
    .max(MAX_DETAIL_LABEL, `Detail label must be ≤ ${MAX_DETAIL_LABEL} characters`)
    .default("Detail"),
});

const featureUpdateSchema = featureInputSchema
  .omit({ ideaId: true })
  .partial()
  .extend({
    id: z.string().min(1, "Feature id is required"),
    ideaId: z.string().min(1, "Idea id is required"),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.notes !== undefined ||
      value.detail !== undefined ||
      value.detailLabel !== undefined,
    {
      message: "Provide a title, notes, detail, or label update",
    },
  );

export function sanitizeFeatureDetailLabel(label: string): string {
  return label.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

export function sanitizeFeatureNotes(notes: string): string {
  return notes.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export function validateFeatureInput(input: FeatureInput): FeatureInput {
  const sanitized = {
    ideaId: input.ideaId.trim(),
    title: input.title.trim(),
    notes: sanitizeFeatureNotes(input.notes),
    starred: input.starred === true,
    detail: input.detail !== undefined ? sanitizeFeatureNotes(input.detail) : "",
    detailLabel: input.detailLabel !== undefined ? sanitizeFeatureDetailLabel(input.detailLabel) || "Detail" : "Detail",
  };
  return featureInputSchema.parse(sanitized);
}

export function validateFeatureUpdate(input: FeatureUpdateInput): FeatureUpdateInput {
  const sanitized = {
    ...input,
    title: input.title?.trim(),
    notes: input.notes !== undefined ? sanitizeFeatureNotes(input.notes) : undefined,
    starred: input.starred === undefined ? undefined : input.starred === true,
    detail: input.detail !== undefined ? sanitizeFeatureNotes(input.detail) : undefined,
    detailLabel:
      input.detailLabel !== undefined ? sanitizeFeatureDetailLabel(input.detailLabel) || "Detail" : undefined,
  };
  return featureUpdateSchema.parse(sanitized);
}
