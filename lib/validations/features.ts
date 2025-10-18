import { z } from "zod";

export type FeatureDetailInput = {
  id?: string;
  label?: string | null;
  body?: string | null;
};

export type FeatureDetailPayload = {
  id?: string;
  label: string;
  body: string;
};

export type FeatureInput = {
  ideaId: string;
  title: string;
  notes: string;
  starred?: boolean;
  superStarred?: boolean;
  detail?: string;
  detailLabel?: string;
  details?: FeatureDetailInput[];
};

export type FeatureUpdateInput = Partial<Omit<FeatureInput, "ideaId">> & { id: string; ideaId: string };

export type FeatureInputPayload = {
  ideaId: string;
  title: string;
  notes: string;
  starred: boolean;
  superStarred: boolean;
  detailSections: FeatureDetailPayload[];
};

export type FeatureUpdatePayload = {
  id: string;
  ideaId: string;
  title?: string;
  notes?: string;
  starred?: boolean;
  superStarred?: boolean;
  detailSections?: FeatureDetailPayload[];
};

const MAX_TITLE = 255;
const MAX_NOTES = 10_000;
const MAX_DETAIL = 10_000;
const MAX_DETAIL_LABEL = 60;
const MAX_DETAIL_SECTIONS = 25;

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
  starred: z.boolean(),
  superStarred: z.boolean(),
  detail: z.string().max(MAX_DETAIL, `Detail must be ≤ ${MAX_DETAIL} characters`).optional(),
  detailLabel: z.string().max(MAX_DETAIL_LABEL, `Detail label must be ≤ ${MAX_DETAIL_LABEL} characters`).optional(),
});

const featureUpdateSchema = z.object({
  id: z.string().min(1, "Feature id is required"),
  ideaId: z.string().min(1, "Idea id is required"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TITLE, `Title must be ≤ ${MAX_TITLE} characters`)
    .optional(),
  notes: z.string().max(MAX_NOTES, `Notes must be ≤ ${MAX_NOTES} characters`).optional(),
  starred: z.boolean().optional(),
  superStarred: z.boolean().optional(),
  detail: z.string().max(MAX_DETAIL, `Detail must be ≤ ${MAX_DETAIL} characters`).optional(),
  detailLabel: z.string().max(MAX_DETAIL_LABEL, `Detail label must be ≤ ${MAX_DETAIL_LABEL} characters`).optional(),
});

export function sanitizeFeatureDetailLabel(label: string): string {
  return label.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

export function sanitizeFeatureNotes(notes: string): string {
  return notes.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function normalizeDetailSections(
  details: unknown,
  fallbackDetail?: string,
  fallbackLabel?: string,
): FeatureDetailPayload[] {
  const rawSections = Array.isArray(details) ? details : [];
  const normalized: FeatureDetailPayload[] = [];

  for (const raw of rawSections) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const candidate = raw as Record<string, unknown>;
    const id =
      typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id.trim() : undefined;
    const labelRaw = candidate.label;
    const bodyRaw = candidate.body;

    const label = sanitizeFeatureDetailLabel(
      labelRaw === undefined || labelRaw === null ? "" : String(labelRaw),
    );
    const bodySanitized = sanitizeFeatureNotes(bodyRaw === undefined || bodyRaw === null ? "" : String(bodyRaw));
    const body = bodySanitized.trim();

    if (!body && !label) {
      continue;
    }

    if (body.length > MAX_DETAIL) {
      throw new Error(`Detail must be ≤ ${MAX_DETAIL} characters`);
    }

    if (label.length > MAX_DETAIL_LABEL) {
      throw new Error(`Detail label must be ≤ ${MAX_DETAIL_LABEL} characters`);
    }

    normalized.push({
      id,
      label: label || "Detail",
      body,
    });
  }

  if (normalized.length > MAX_DETAIL_SECTIONS) {
    throw new Error(`Features support up to ${MAX_DETAIL_SECTIONS} detail sections`);
  }

  const fallbackBody = fallbackDetail?.trim() ?? "";
  if (normalized.length === 0 && fallbackBody) {
    if (fallbackBody.length > MAX_DETAIL) {
      throw new Error(`Detail must be ≤ ${MAX_DETAIL} characters`);
    }
    const fallbackLabelNormalized = sanitizeFeatureDetailLabel(fallbackLabel ?? "");
    normalized.push({
      id: undefined,
      label: fallbackLabelNormalized || "Detail",
      body: fallbackBody,
    });
  }

  return normalized;
}

export function validateFeatureInput(input: FeatureInput): FeatureInputPayload {
  const sanitized = {
    ideaId: input.ideaId.trim(),
    title: input.title.trim(),
    notes: sanitizeFeatureNotes(input.notes),
    starred: input.starred === true,
    superStarred: input.superStarred === true,
    detail: input.detail !== undefined ? sanitizeFeatureNotes(input.detail) : undefined,
    detailLabel:
      input.detailLabel !== undefined ? sanitizeFeatureDetailLabel(input.detailLabel) || "Detail" : undefined,
  };

  const parsed = featureInputSchema.parse(sanitized);
  const detailSections = normalizeDetailSections(input.details, parsed.detail, parsed.detailLabel);
  const superStarred = parsed.superStarred === true;
  const starred = superStarred ? true : parsed.starred;

  return {
    ideaId: parsed.ideaId,
    title: parsed.title,
    notes: parsed.notes,
    starred,
    superStarred,
    detailSections,
  };
}

export function validateFeatureUpdate(input: FeatureUpdateInput): FeatureUpdatePayload {
  const sanitized = {
    id: input.id.trim(),
    ideaId: input.ideaId.trim(),
    title: input.title?.trim(),
    notes: input.notes !== undefined ? sanitizeFeatureNotes(input.notes) : undefined,
    starred: input.starred === undefined ? undefined : input.starred === true,
    superStarred: input.superStarred === undefined ? undefined : input.superStarred === true,
    detail: input.detail !== undefined ? sanitizeFeatureNotes(input.detail) : undefined,
    detailLabel:
      input.detailLabel !== undefined ? sanitizeFeatureDetailLabel(input.detailLabel) || "Detail" : undefined,
  };

  const parsed = featureUpdateSchema.parse(sanitized);

  let detailSections: FeatureDetailPayload[] | undefined;
  if (input.details !== undefined) {
    detailSections = normalizeDetailSections(input.details, parsed.detail, parsed.detailLabel);
  } else if (input.detail !== undefined || input.detailLabel !== undefined) {
    detailSections = normalizeDetailSections([], parsed.detail, parsed.detailLabel);
  }

  const hasUpdates =
    parsed.title !== undefined ||
    parsed.notes !== undefined ||
    parsed.detail !== undefined ||
    parsed.detailLabel !== undefined ||
    parsed.starred !== undefined ||
    parsed.superStarred !== undefined ||
    detailSections !== undefined;

  if (!hasUpdates) {
    throw new Error("Provide a title, notes, detail, or label update");
  }

  return {
    id: parsed.id,
    ideaId: parsed.ideaId,
    title: parsed.title,
    notes: parsed.notes,
    starred: parsed.starred,
    superStarred: parsed.superStarred,
    detailSections,
  };
}
