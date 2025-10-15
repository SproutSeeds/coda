"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { createFeature, listFeatures, setFeatureCompletion, updateFeature, type FeatureRecord } from "@/lib/db/features";
import { createIdea, listIdeas, updateIdea, updateIdeaStar, type IdeaRecord } from "@/lib/db/ideas";
import { trackEvent } from "@/lib/utils/analytics";
import { buildImportAnalysis, type ImportPlanEntry } from "@/lib/utils/import-diff";
import {
  MAX_IMPORT_SIZE_BYTES,
  coerceImportPayload,
  normalizeIdeaTitle,
  parseImportEnvelope,
  type ConflictDecision,
  type IdeaImportBundle,
  type ImportEnvelope,
} from "@/lib/validations/import";
import type { FeatureInput, FeatureUpdateInput } from "@/lib/validations/features";
import { ZodError } from "zod";

type ImportAnalysis = ReturnType<typeof buildImportAnalysis>;

export type ImportIdeasPreviewResponse = {
  status: "preview";
  diff: ImportAnalysis["summary"] & { entries: ImportAnalysis["entries"] };
};

export type ImportIdeasCommitResponse = {
  status: "complete";
  summary: {
    createdIdeas: number;
    updatedIdeas: number;
    createdFeatures: number;
    updatedFeatures: number;
    skipped: number;
  };
};

export type ImportIdeasResponse = ImportIdeasPreviewResponse | ImportIdeasCommitResponse;

export async function importIdeasAction(formData: FormData): Promise<ImportIdeasResponse> {
  const user = await requireUser();
  const stage = String(formData.get("stage") ?? "preview");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Select a JSON export file to import");
  }

  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    throw new Error("Import file exceeds the 5 MB size limit");
  }

  let payload: unknown;
  try {
    const text = await file.text();
    payload = JSON.parse(text);
  } catch {
    throw new Error("Invalid import file: unable to parse JSON");
  }

  const coercedPayload = coerceImportPayload(payload);

  let envelope: ImportEnvelope;
  try {
    envelope = parseImportEnvelope({ payload: coercedPayload, sizeInBytes: file.size });
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues.map((issue) => issue.message).join("; ") || "Invalid structure";
      throw new Error(`Invalid import file: ${detail}`);
    }
    throw error;
  }

  const existingIdeas = await collectIdeas(user.id);
  const existingFeatures = await collectRelevantFeatures(user.id, envelope, existingIdeas);

  const analysis = buildImportAnalysis({ envelope, existingIdeas, existingFeaturesByIdea: existingFeatures });

  if (stage === "preview") {
    await trackEvent({
      name: "ideas_import_attempt",
      properties: {
        schemaVersion: envelope.schemaVersion,
        ideaCount: envelope.ideaCount,
        featureCount: envelope.featureCount,
        conflicts: analysis.summary.conflicts.length,
      },
    });

    return {
      status: "preview",
      diff: {
        ...analysis.summary,
        entries: analysis.entries,
      },
    };
  }

  if (stage !== "commit") {
    throw new Error(`Unsupported import stage: ${stage}`);
  }

  const decisions = parseDecisionPayload(formData.get("decisions"));
  const start = Date.now();

  const counters = {
    createdIdeas: 0,
    updatedIdeas: 0,
    createdFeatures: 0,
    updatedFeatures: 0,
    skipped: analysis.summary.skippedFeatures,
  };

  try {
    for (const entry of analysis.entries) {
      const action = determineAction(entry, decisions);

      if (action === "create") {
        const result = await createIdeaFromBundle(user.id, entry.bundle);
        counters.createdIdeas += 1;
        counters.createdFeatures += result.createdFeatures;
      } else if (entry.existingIdea) {
        const result = await applyIdeaUpdate(user.id, entry);
        if (result.updated) {
          counters.updatedIdeas += 1;
        }
        counters.createdFeatures += result.createdFeatures;
        counters.updatedFeatures += result.updatedFeatures;
      }
    }
  } catch (error) {
    await trackEvent({
      name: "ideas_import_error",
      properties: {
        reason: error instanceof Error ? error.message : "unknown",
        validationErrors: analysis.summary.messages,
      },
    });
    throw error;
  }

  revalidatePath("/dashboard/ideas");

  await trackEvent({
    name: "ideas_import_complete",
    properties: {
      created: counters.createdIdeas,
      updated: counters.updatedIdeas,
      skipped: counters.skipped,
      duration: Date.now() - start,
    },
  });

  return {
    status: "complete",
    summary: counters,
  };
}

async function collectIdeas(userId: string): Promise<IdeaRecord[]> {
  const ideas: IdeaRecord[] = [];
  let cursor: string | undefined;

  while (true) {
    const { items, nextCursor } = await listIdeas(userId, 200, cursor, "priority");
    ideas.push(...items);
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return ideas;
}

async function collectRelevantFeatures(userId: string, envelope: ImportEnvelope, existingIdeas: IdeaRecord[]): Promise<Map<string, FeatureRecord[]>> {
  const byTitle = new Map<string, IdeaRecord>();
  existingIdeas.forEach((idea) => {
    const normalized = normalizeIdeaTitle(idea.title);
    if (!byTitle.has(normalized)) {
      byTitle.set(normalized, idea);
    }
  });

  const relevantIds = new Set<string>();
  envelope.ideas.forEach((bundle) => {
    const normalized = normalizeIdeaTitle(bundle.idea.title);
    const match = byTitle.get(normalized);
    if (match) {
      relevantIds.add(match.id);
    }
  });

  const featureMap = new Map<string, FeatureRecord[]>();
  await Promise.all(
    Array.from(relevantIds).map(async (ideaId) => {
      const features = await listFeatures(userId, ideaId);
      featureMap.set(ideaId, features);
    }),
  );

  return featureMap;
}

interface DecisionLookup {
  map: Map<string, "update" | "create-new">;
  defaultAction?: "update" | "create-new";
}

function parseDecisionPayload(value: FormDataEntryValue | null): DecisionLookup {
  if (value === null || value === undefined || value === "") {
    return { map: new Map() };
  }

  if (typeof value !== "string") {
    throw new Error("Invalid decisions payload");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Failed to parse conflict decisions");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Conflict decisions must be an array");
  }

  const map = new Map<string, "update" | "create-new">();
  let defaultAction: "update" | "create-new" | undefined;

  for (const entry of parsed as ConflictDecision[]) {
    if (!entry?.ideaTitle || (entry.action !== "update" && entry.action !== "create-new")) {
      continue;
    }
    const normalized = normalizeIdeaTitle(entry.ideaTitle);
    map.set(normalized, entry.action);
    if (entry.applyToAll) {
      defaultAction = entry.action;
    }
  }

  return { map, defaultAction };
}

function determineAction(entry: ImportPlanEntry, decisions: DecisionLookup): "create" | "update" {
  if (!entry.existingIdea) {
    return "create";
  }

  const normalized = entry.normalizedTitle;
  const decision = decisions.map.get(normalized) ?? decisions.defaultAction;
  if (!decision) {
    throw new Error(`Missing import decision for "${entry.bundle.idea.title}"`);
  }

  return decision === "create-new" ? "create" : "update";
}

async function createIdeaFromBundle(userId: string, bundle: IdeaImportBundle) {
  const notes = bundle.idea.notes?.length ? bundle.idea.notes : "Imported idea";
  const idea = await createIdea(userId, {
    title: bundle.idea.title,
    notes,
    githubUrl: bundle.idea.githubUrl ?? undefined,
    linkLabel: bundle.idea.linkLabel ?? undefined,
  });

  if (bundle.idea.starred) {
    await updateIdeaStar(userId, idea.id, true);
  }

  let createdFeatures = 0;
  for (const feature of bundle.features) {
    const featureInput: FeatureInput = {
      ideaId: idea.id,
      title: feature.title,
      notes: feature.notes?.length ? feature.notes : "Imported feature",
      detail: feature.detail ?? "",
      detailLabel: feature.detailLabel ?? "Detail",
      starred: feature.starred ?? false,
    };
    const created = await createFeature(userId, featureInput);
    createdFeatures += 1;
    if (feature.completed) {
      await setFeatureCompletion(userId, created.id, true);
    }
  }

  return { createdFeatures };
}

async function applyIdeaUpdate(userId: string, entry: ImportPlanEntry) {
  const result = {
    updated: false,
    createdFeatures: 0,
    updatedFeatures: 0,
  };

  if (!entry.existingIdea) {
    return result;
  }

  const fields = entry.ideaUpdates;
  if (Object.keys(fields).length > 0) {
    await updateIdea(userId, entry.existingIdea.id, {
      ...fields,
      updatedAt: new Date(),
    });
    result.updated = true;
  }

  if (entry.starredChange !== undefined) {
    await updateIdeaStar(userId, entry.existingIdea.id, entry.starredChange);
    result.updated = true;
  }

  for (const feature of entry.featureUpdates) {
    const updatePayload: FeatureUpdateInput = {
      id: feature.existing.id,
      ideaId: feature.existing.ideaId,
    };
    let hasFieldUpdates = false;

    if (feature.changes.title !== undefined) {
      updatePayload.title = feature.changes.title;
      hasFieldUpdates = true;
    }
    if (feature.changes.notes !== undefined) {
      updatePayload.notes = feature.changes.notes;
      hasFieldUpdates = true;
    }
    if (feature.changes.detail !== undefined) {
      updatePayload.detail = feature.changes.detail;
      hasFieldUpdates = true;
    }
    if (feature.changes.detailLabel !== undefined) {
      updatePayload.detailLabel = feature.changes.detailLabel;
      hasFieldUpdates = true;
    }
    if (feature.changes.starred !== undefined) {
      updatePayload.starred = feature.changes.starred;
      hasFieldUpdates = true;
    }

    if (hasFieldUpdates) {
      await updateFeature(userId, updatePayload);
      result.updated = true;
      result.updatedFeatures += 1;
    }

    if (feature.changes.completed !== undefined) {
      await setFeatureCompletion(userId, feature.existing.id, feature.changes.completed);
      result.updated = true;
      if (!hasFieldUpdates) {
        result.updatedFeatures += 1;
      }
    }
  }

  for (const feature of entry.featureInserts) {
    const featureInput: FeatureInput = {
      ideaId: entry.existingIdea.id,
      title: feature.title,
      notes: feature.notes?.length ? feature.notes : "Imported feature",
      detail: feature.detail ?? "",
      detailLabel: feature.detailLabel ?? "Detail",
      starred: feature.starred ?? false,
    };
    const created = await createFeature(userId, featureInput);
    result.createdFeatures += 1;
    result.updated = true;
    if (feature.completed) {
      await setFeatureCompletion(userId, created.id, true);
    }
  }

  return result;
}
