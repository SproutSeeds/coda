import { normalizeIdeaTitle, partitionFeatureMergeCandidates, type FeatureDetailImportItem, type FeatureImportItem, type IdeaImportBundle, type IdeaImportMetadata, type ImportEnvelope } from "@/lib/validations/import";
import type { IdeaRecord } from "@/lib/db/ideas";
import type { FeatureRecord } from "@/lib/db/features";

export type ImportDecisionAction = "update" | "create-new";

export interface ConflictPreview {
  ideaTitle: string;
  existingIdeaId: string;
  existingIdeaTitle: string;
  normalizedTitle: string;
}

export interface DiffSummary {
  newIdeas: number;
  updatedIdeas: number;
  unchangedIdeas: number;
  newFeatures: number;
  updatedFeatures: number;
  skippedFeatures: number;
  conflicts: ConflictPreview[];
  messages: string[];
}

export interface FeatureUpdatePlan {
  existing: FeatureRecord;
  changes: Partial<FeatureChangeSet>;
  payload: FeatureImportItem;
}

export interface FeatureChangeSet {
  title?: string;
  notes?: string;
  detailSections?: FeatureDetailImportItem[];
  starred?: boolean;
  completed?: boolean;
  completedAt?: string | null;
}

export interface ImportPlanEntry {
  normalizedTitle: string;
  bundle: IdeaImportBundle;
  existingIdea?: IdeaRecord;
  ideaUpdates: Partial<Pick<IdeaImportMetadata, "title" | "notes" | "githubUrl" | "linkLabel">>;
  starredChange?: boolean;
  featureUpdates: FeatureUpdatePlan[];
  featureInserts: FeatureImportItem[];
  skippedFeatureCount: number;
  warnings: string[];
  hasConflict: boolean;
  defaultAction: ImportDecisionAction;
}

export interface ImportAnalysisResult {
  summary: DiffSummary;
  entries: ImportPlanEntry[];
}

export interface BuildImportAnalysisOptions {
  envelope: ImportEnvelope;
  existingIdeas: IdeaRecord[];
  existingFeaturesByIdea?: Map<string, FeatureRecord[]>;
}

export function buildImportAnalysis({ envelope, existingIdeas, existingFeaturesByIdea = new Map() }: BuildImportAnalysisOptions): ImportAnalysisResult {
  const ideasByNormalized = new Map<string, IdeaRecord>();
  existingIdeas.forEach((idea) => {
    const key = normalizeIdeaTitle(idea.title);
    if (!ideasByNormalized.has(key)) {
      ideasByNormalized.set(key, idea);
    }
  });

  const summary: DiffSummary = {
    newIdeas: 0,
    updatedIdeas: 0,
    unchangedIdeas: 0,
    newFeatures: 0,
    updatedFeatures: 0,
    skippedFeatures: 0,
    conflicts: [],
    messages: [],
  };

  const entries: ImportPlanEntry[] = [];

  for (const bundle of envelope.ideas) {
    const normalizedTitle = normalizeIdeaTitle(bundle.idea.title);
    const existingIdea = ideasByNormalized.get(normalizedTitle);

    const featureBuckets = partitionFeatureMergeCandidates(bundle.features);

    const featuresForIdea = existingIdea ? existingFeaturesByIdea.get(existingIdea.id) ?? [] : [];
    const featureMap = new Map(featuresForIdea.map((feature) => [feature.id, feature]));

    const featureUpdates: FeatureUpdatePlan[] = [];
    const featureInserts: FeatureImportItem[] = [];
    let skippedFeatureCount = 0;
    const warnings: string[] = [];

    for (const feature of featureBuckets.updates) {
      const targetId = feature.id?.trim();
      if (!targetId) {
        skippedFeatureCount += 1;
        const message = `Skipped feature update for "${feature.title}" because id was missing.`;
        warnings.push(message);
        continue;
      }

      const existingFeature = featureMap.get(targetId);
      if (!existingFeature) {
        skippedFeatureCount += 1;
        const message = `Skipped feature update for "${feature.title}" because no existing feature matched id ${targetId}.`;
        warnings.push(message);
        continue;
      }

      const changes: Partial<FeatureChangeSet> = {};
      if (feature.title && feature.title !== existingFeature.title) {
        changes.title = feature.title;
      }
      if (feature.notes !== undefined && feature.notes !== existingFeature.notes) {
        changes.notes = feature.notes;
      }
      const detailSections = computeDetailSectionChanges(existingFeature.detailSections, feature.detailSections);
      if (detailSections !== undefined) {
        changes.detailSections = detailSections;
      }
      if (feature.starred !== undefined && feature.starred !== existingFeature.starred) {
        changes.starred = feature.starred;
      }
      if (feature.completed !== undefined && feature.completed !== existingFeature.completed) {
        changes.completed = feature.completed;
        if (feature.completedAt !== undefined) {
          changes.completedAt = feature.completedAt ?? null;
        }
      } else if (feature.completedAt !== undefined && feature.completedAt !== existingFeature.completedAt) {
        changes.completedAt = feature.completedAt ?? null;
      }

      if (Object.keys(changes).length > 0) {
        featureUpdates.push({ existing: existingFeature, changes, payload: feature });
      }
    }

    for (const feature of featureBuckets.inserts) {
      featureInserts.push(feature);
    }

    const { fields: ideaUpdates, starredChange } = existingIdea
      ? calculateIdeaChanges(existingIdea, bundle.idea)
      : { fields: {}, starredChange: undefined };

    const hasConflict = Boolean(existingIdea);
    const defaultAction: ImportDecisionAction = hasConflict ? "update" : "create-new";

    if (!existingIdea) {
      summary.newIdeas += 1;
      summary.newFeatures += featureInserts.length + featureUpdates.length;
    } else {
      const hasIdeaChanges = Object.keys(ideaUpdates).length > 0 || starredChange !== undefined;
      const hasFeatureUpdates = featureUpdates.length > 0;
      const hasFeatureInserts = featureInserts.length > 0;

      if (hasIdeaChanges || hasFeatureUpdates || hasFeatureInserts) {
        summary.updatedIdeas += 1;
      } else {
        summary.unchangedIdeas += 1;
      }

      summary.newFeatures += featureInserts.length;
      summary.updatedFeatures += featureUpdates.length;
      summary.conflicts.push({
        ideaTitle: bundle.idea.title,
        existingIdeaId: existingIdea.id,
        existingIdeaTitle: existingIdea.title,
        normalizedTitle,
      });
    }

    summary.skippedFeatures += skippedFeatureCount;

    entries.push({
      normalizedTitle,
      bundle,
      existingIdea,
      ideaUpdates,
      starredChange,
      featureUpdates,
      featureInserts,
      skippedFeatureCount,
      warnings,
      hasConflict,
      defaultAction,
    });
  }

  return {
    summary: {
      ...summary,
      conflicts: summary.conflicts,
    },
    entries,
  };
}

function computeDetailSectionChanges(
  existing: FeatureRecord["detailSections"],
  incoming?: FeatureDetailImportItem[],
): FeatureDetailImportItem[] | undefined {
  const normalizedIncoming =
    incoming?.flatMap((section, index) => {
      if (!section) return [];
      const label = typeof section.label === "string" ? section.label.trim() : "";
      const body = typeof section.body === "string" ? section.body.trim() : "";
      if (!label && !body) {
        return [];
      }
      return [
        {
          id: section.id ?? existing[index]?.id,
          label: label || "Detail",
          body,
          position: section.position ?? existing[index]?.position ?? (index + 1) * 1000,
        },
      ];
    }) ?? [];

  if (normalizedIncoming.length !== existing.length) {
    return normalizedIncoming;
  }

  for (let index = 0; index < normalizedIncoming.length; index += 1) {
    const incomingSection = normalizedIncoming[index]!;
    const existingSection = existing[index]!;
    if (incomingSection.label !== existingSection.label || incomingSection.body !== existingSection.body) {
      return normalizedIncoming;
    }
  }

  return undefined;
}

function calculateIdeaChanges(existing: IdeaRecord, incoming: IdeaImportMetadata): {
  fields: Partial<Pick<IdeaImportMetadata, "title" | "notes" | "githubUrl" | "linkLabel">>;
  starredChange?: boolean;
} {
  const fields: Partial<Pick<IdeaImportMetadata, "title" | "notes" | "githubUrl" | "linkLabel">> = {};
  let starredChange: boolean | undefined;

  if (incoming.title && incoming.title !== existing.title) {
    fields.title = incoming.title;
  }

  if (incoming.notes !== undefined && incoming.notes !== existing.notes) {
    fields.notes = incoming.notes;
  }

  if (incoming.githubUrl !== undefined && incoming.githubUrl !== existing.githubUrl) {
    fields.githubUrl = incoming.githubUrl;
  }

  if (incoming.linkLabel !== undefined && incoming.linkLabel !== existing.linkLabel) {
    fields.linkLabel = incoming.linkLabel;
  }

  if (incoming.starred !== undefined && incoming.starred !== existing.starred) {
    starredChange = incoming.starred;
  }

  return { fields, starredChange };
}
