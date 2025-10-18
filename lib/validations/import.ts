import { z } from "zod";

export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const IDEA_TITLE_MAX = 140;
const FEATURE_TITLE_MAX = 140;
const LINK_LABEL_MAX = 120;

const nullableTrimmedString = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return undefined;
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? undefined : trimmed;
    });

const coerceNumber = () =>
  z
    .union([z.number(), z.string()])
    .transform((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const coerced = Number(value);
      if (Number.isNaN(coerced)) {
        throw new Error("Position must be numeric");
      }
      return coerced;
    })
    .optional();

const featureDetailSectionSchema = z.object({
  id: nullableTrimmedString(),
  label: nullableTrimmedString(),
  body: z.union([z.string(), z.null(), z.undefined()]).transform((value) =>
    value === null || value === undefined ? undefined : String(value),
  ),
  position: coerceNumber(),
});

const featureSchema = z.object({
  id: nullableTrimmedString(),
  ideaId: nullableTrimmedString(),
  title: z
    .string()
    .trim()
    .min(1, "Feature title is required")
    .max(FEATURE_TITLE_MAX, `Feature title must be ≤ ${FEATURE_TITLE_MAX} characters`),
  notes: nullableTrimmedString(),
  detail: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  detailLabel: nullableTrimmedString(),
  position: coerceNumber(),
  starred: z.boolean().optional(),
  superStarred: z.boolean().optional(),
  completed: z.boolean().optional(),
  completedAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  deletedAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  detailSections: z.array(featureDetailSectionSchema).optional(),
});

const ideaSchema = z.object({
  id: nullableTrimmedString(),
  userId: nullableTrimmedString(),
  title: z
    .string()
    .trim()
    .min(1, "Idea title is required")
    .max(IDEA_TITLE_MAX, `Idea title must be ≤ ${IDEA_TITLE_MAX} characters`),
  notes: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  position: coerceNumber(),
  createdAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  updatedAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  starred: z.boolean().optional(),
  githubUrl: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null) return null;
      if (value === undefined) return undefined;
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? null : trimmed;
    }),
  linkLabel: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return undefined;
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? undefined : trimmed;
    })
    .refine((value) => value === undefined || value.length <= LINK_LABEL_MAX, {
      message: `Link label must be ≤ ${LINK_LABEL_MAX} characters`,
    }),
  deletedAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  undoToken: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
  undoExpiresAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
});

const ideaBundleSchema = z.object({
  idea: ideaSchema,
  features: z.array(featureSchema),
});

const envelopeSchema = z
  .object({
    schemaVersion: z.union([z.number(), z.null(), z.undefined()]).transform((value) => {
      if (value === null || value === undefined) return 1;
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("schemaVersion must be a positive integer");
      }
      return value;
    }),
    exportedAt: z.union([z.string(), z.null(), z.undefined()]).transform((value) => (value ?? undefined)),
    ideaCount: z.number().int().min(0, "ideaCount must be ≥ 0"),
    featureCount: z.number().int().min(0, "featureCount must be ≥ 0"),
    ideas: z.array(ideaBundleSchema),
  })
  .superRefine((data, ctx) => {
    if (data.ideas.length !== data.ideaCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ideaCount mismatch: expected ${data.ideaCount}, received ${data.ideas.length}`,
      });
    }

    const totalFeatures = data.ideas.reduce((sum, bundle) => sum + bundle.features.length, 0);
    if (totalFeatures !== data.featureCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `featureCount mismatch: expected ${data.featureCount}, received ${totalFeatures}`,
      });
    }
  });

export interface FeatureDetailImportItem {
  id?: string;
  label?: string;
  body?: string;
  position?: number;
}

export interface FeatureImportItem {
  id?: string;
  ideaId?: string;
  title: string;
  notes?: string;
  detail?: string;
  detailLabel?: string;
  detailSections?: FeatureDetailImportItem[];
  position?: number;
  starred?: boolean;
  superStarred?: boolean;
  completed?: boolean;
  completedAt?: string;
  deletedAt?: string;
}

export interface IdeaImportMetadata {
  id?: string;
  userId?: string;
  title: string;
  notes?: string;
  position?: number;
  createdAt?: string;
  updatedAt?: string;
  starred?: boolean;
  githubUrl?: string | null;
  linkLabel?: string;
  deletedAt?: string;
  undoToken?: string;
  undoExpiresAt?: string;
}

export interface IdeaImportBundle {
  idea: IdeaImportMetadata;
  features: FeatureImportItem[];
}

export interface ImportEnvelope {
  schemaVersion: number;
  exportedAt?: string;
  ideaCount: number;
  featureCount: number;
  ideas: IdeaImportBundle[];
}

export interface ConflictDecision {
  ideaTitle: string;
  action: "update" | "create-new";
  applyToAll?: boolean;
}

function ensureSizeWithinLimit(sizeInBytes: number) {
  if (Number.isNaN(sizeInBytes) || sizeInBytes <= 0) {
    return;
  }

  if (sizeInBytes > MAX_IMPORT_SIZE_BYTES) {
    throw new Error("Import file exceeds the 5 MB size limit");
  }
}

function sanitizeIdea({
  id,
  userId,
  title,
  notes,
  position,
  createdAt,
  updatedAt,
  starred,
  githubUrl,
  linkLabel,
  deletedAt,
  undoToken,
  undoExpiresAt,
}: z.infer<typeof ideaSchema>): IdeaImportMetadata {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length === 0) {
    throw new Error("Idea title is required");
  }

  return {
    id,
    userId,
    title: normalizedTitle,
    notes: notes?.trim() ?? undefined,
    position,
    createdAt,
    updatedAt,
    starred,
    githubUrl,
    linkLabel,
    deletedAt,
    undoToken,
    undoExpiresAt,
  };
}

function sanitizeFeature(feature: z.infer<typeof featureSchema>): FeatureImportItem {
  const normalizedTitle = feature.title.trim();
  if (normalizedTitle.length === 0) {
    throw new Error("Feature title is required");
  }

  const normalizedDetailSections =
    feature.detailSections?.flatMap((section, index) => {
      const label = section.label ?? undefined;
      const body = section.body ?? undefined;
      const trimmedBody = typeof body === "string" ? body.trim() : undefined;
      const trimmedLabel = label?.trim();

      if (!trimmedBody && !trimmedLabel) {
        return [];
      }

      return [
        {
          id: section.id ?? undefined,
          label: trimmedLabel && trimmedLabel.length > 0 ? trimmedLabel : "Detail",
          body: trimmedBody ?? "",
          position: section.position ?? (index + 1) * 1000,
        },
      ];
    }) ?? [];

  if (normalizedDetailSections.length === 0 && feature.detail && feature.detail.trim().length > 0) {
    normalizedDetailSections.push({
      id: undefined,
      label: feature.detailLabel?.trim?.() ? feature.detailLabel!.trim() : "Detail",
      body: feature.detail,
      position: 1000,
    });
  }

  const primaryDetail = normalizedDetailSections[0];

  return {
    id: feature.id,
    ideaId: feature.ideaId,
    title: normalizedTitle,
    notes: feature.notes?.trim() ?? undefined,
    detail: primaryDetail?.body ?? feature.detail ?? undefined,
    detailLabel: primaryDetail?.label ?? feature.detailLabel,
    detailSections: normalizedDetailSections.length > 0 ? normalizedDetailSections : undefined,
    position: feature.position,
    starred: feature.starred,
    superStarred: feature.superStarred,
    completed: feature.completed,
    completedAt: feature.completedAt ?? undefined,
    deletedAt: feature.deletedAt ?? undefined,
  };
}

export function coerceImportPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if (!("idea" in record)) {
    return payload;
  }

  const idea = record.idea;
  if (!idea || typeof idea !== "object") {
    return payload;
  }

  const typedIdea = idea as Record<string, unknown>;
  if (typeof typedIdea.title !== "string" || typedIdea.title.trim().length === 0) {
    return payload;
  }

  const featuresRaw = Array.isArray(record.features) ? record.features : [];
  const normalizedFeatures = featuresRaw.filter((feature) => feature && typeof feature === "object");

  return {
    schemaVersion: 1,
    exportedAt: undefined,
    ideaCount: 1,
    featureCount: normalizedFeatures.length,
    ideas: [
      {
        idea: typedIdea,
        features: normalizedFeatures,
      },
    ],
  } as unknown as Partial<ImportEnvelope>;
}

export function parseImportEnvelope({ payload, sizeInBytes }: { payload: unknown; sizeInBytes: number }): ImportEnvelope {
  ensureSizeWithinLimit(sizeInBytes);

  if (payload === null || typeof payload !== "object") {
    throw new Error("Invalid import file: expected a JSON object");
  }

  const parsed = envelopeSchema.parse(payload);

  const bundles: IdeaImportBundle[] = parsed.ideas.map((bundle) => ({
    idea: sanitizeIdea(bundle.idea),
    features: bundle.features.map(sanitizeFeature),
  }));

  const ideaCount = bundles.length;
  const featureCount = bundles.reduce((sum, bundle) => sum + bundle.features.length, 0);

  if (ideaCount !== parsed.ideaCount || featureCount !== parsed.featureCount) {
    throw new Error("Import counts do not match provided ideaCount/featureCount");
  }

  return {
    schemaVersion: parsed.schemaVersion,
    exportedAt: parsed.exportedAt,
    ideaCount,
    featureCount,
    ideas: bundles,
  };
}

export function normalizeIdeaTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function partitionFeatureMergeCandidates(features: FeatureImportItem[]): {
  updates: FeatureImportItem[];
  inserts: FeatureImportItem[];
} {
  return features.reduce(
    (acc, feature) => {
      const hasId = typeof feature.id === "string" && feature.id.trim().length > 0;
      if (hasId) {
        acc.updates.push({ ...feature, id: feature.id!.trim() });
      } else {
        acc.inserts.push({ ...feature, id: undefined });
      }
      return acc;
    },
    { updates: [] as FeatureImportItem[], inserts: [] as FeatureImportItem[] },
  );
}
