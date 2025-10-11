"use server";

import { redirect } from "next/navigation";

import { createFeature, deleteFeature, getFeatureById, listDeletedFeatures, listFeatures, reorderFeatures, restoreFeature, setFeatureCompletion, updateFeature, updateFeatureStar } from "@/lib/db/features";
import { createIdea, getIdea, listDeletedIdeas, listIdeas, purgeIdea, reorderIdeas, restoreIdea, searchIdeas, softDeleteIdea, updateIdea, updateIdeaStar, type IdeaSort } from "@/lib/db/ideas";
import { trackEvent } from "@/lib/utils/analytics";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { consumeUndoToken, createUndoToken } from "@/lib/utils/undo";
import { requireUser } from "@/lib/auth/session";

export async function createIdeaAction(formData: FormData | { title: string; notes: string }) {
  const user = await requireUser();
  const key = `${user.id}:create`;
  const rate = await consumeRateLimit(key);
  if (!rate.success) {
    throw new Error("Rate limit exceeded. Please try again shortly.");
  }

  const payload = formData instanceof FormData
    ? {
        title: String(formData.get("title") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      }
    : formData;

  const idea = await createIdea(user.id, payload);
  await trackEvent({ name: "idea_created", properties: { ideaId: idea.id } });
  return idea;
}

export async function updateIdeaAction(input: { id: string; title?: string; notes?: string; githubUrl?: string | null; linkLabel?: string | null; updatedAt: string }) {
  const user = await requireUser();
  const idea = await updateIdea(user.id, input.id, {
    title: input.title,
    notes: input.notes,
    githubUrl: input.githubUrl,
    linkLabel: input.linkLabel,
    updatedAt: new Date(input.updatedAt),
  });
  await trackEvent({ name: "idea_updated", properties: { ideaId: idea.id } });
  return idea;
}

export async function deleteIdeaAction(input: { id: string }) {
  const user = await requireUser();
  const undo = createUndoToken(input.id);
  const idea = await softDeleteIdea(user.id, input.id, undo.token, undo.expiresAt);
  await trackEvent({ name: "idea_deleted", properties: { ideaId: idea.id } });
  return { undoToken: undo.token, expiresAt: undo.expiresAt.toISOString() };
}

export async function restoreIdeaAction(input: { id: string; token: string }) {
  const user = await requireUser();
  const record = consumeUndoToken(input.token);
  if (!record || record.ideaId !== input.id) {
    throw new Error("Undo token expired");
  }
  const idea = await restoreIdea(user.id, input.id);
  await trackEvent({ name: "idea_restored", properties: { ideaId: idea.id } });
  return idea;
}

export async function searchIdeasAction(query: string) {
  const user = await requireUser();
  const rate = await consumeRateLimit(`${user.id}:search`);
  if (!rate.success) {
    throw new Error("Rate limit exceeded. Please try again shortly.");
  }
  const results = await searchIdeas(user.id, query);
  await trackEvent({ name: "idea_searched", properties: { query } });
  return results;
}

export async function loadIdeas(searchParams: { q?: string; cursor?: string; sort?: IdeaSort }) {
  const user = await requireUser();
  if (searchParams.q) {
    return {
      items: await searchIdeas(user.id, searchParams.q),
      nextCursor: null,
    };
  }
  const allowedSorts: IdeaSort[] = ["priority", "created_desc", "updated_desc", "title_asc"];
  const sort = searchParams.sort && allowedSorts.includes(searchParams.sort) ? searchParams.sort : "priority";
  return listIdeas(user.id, 100, searchParams.cursor, sort);
}

export async function loadIdea(id: string) {
  const user = await requireUser();
  return getIdea(user.id, id);
}

export async function loadIdeaWithFeatures(id: string) {
  const user = await requireUser();
  const idea = await getIdea(user.id, id);
  const [features, deletedFeatures] = await Promise.all([
    listFeatures(user.id, id),
    listDeletedFeatures(user.id, id),
  ]);
  return { idea, features, deletedFeatures };
}

export async function exportIdeaAsJsonAction(id: string) {
  const user = await requireUser();
  const idea = await getIdea(user.id, id);
  const features = await listFeatures(user.id, id);
  return {
    idea,
    features,
  };
}

export async function requireAuth() {
  await requireUser();
  redirect("/dashboard/ideas");
}

export async function reorderIdeasAction(ids: string[]) {
  const user = await requireUser();
  await reorderIdeas(user.id, ids);
  await trackEvent({ name: "idea_reordered", properties: { count: ids.length } });
}

export async function toggleIdeaStarAction(id: string, starred: boolean) {
  const user = await requireUser();
  const idea = await updateIdeaStar(user.id, id, starred);
  await trackEvent({ name: starred ? "idea_starred" : "idea_unstarred", properties: { ideaId: id } });
  return idea;
}

export async function restoreDeletedIdeaAction(id: string) {
  const user = await requireUser();
  const idea = await restoreIdea(user.id, id);
  await trackEvent({ name: "idea_restored", properties: { ideaId: idea.id, source: "recently_deleted" } });
  return idea;
}

export async function purgeDeletedIdeaAction(id: string) {
  const user = await requireUser();
  await purgeIdea(user.id, id);
  await trackEvent({ name: "idea_purged", properties: { ideaId: id } });
}


export async function loadDeletedIdeas() {
  const user = await requireUser();
  return listDeletedIdeas(user.id);
}

export async function createFeatureAction(formData: FormData | { ideaId: string; title: string; notes: string; starred?: boolean }) {
  const user = await requireUser();
  const payload = formData instanceof FormData
    ? {
        ideaId: String(formData.get("ideaId") ?? ""),
        title: String(formData.get("title") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        starred: (() => {
          const value = formData.get("starred");
          if (value == null) return false;
          const normalized = String(value).toLowerCase();
          return normalized === "true" || normalized === "on" || normalized === "1";
        })(),
      }
    : formData;

  const feature = await createFeature(user.id, payload);
  await trackEvent({
    name: "feature_created",
    properties: { ideaId: payload.ideaId, featureId: feature.id, starred: payload.starred ?? false },
  });
  return feature;
}

export async function updateFeatureAction(payload: { id: string; ideaId: string; title?: string; notes?: string }) {
  const user = await requireUser();
  const feature = await updateFeature(user.id, payload);
  await trackEvent({ name: "feature_updated", properties: { ideaId: payload.ideaId, featureId: feature.id } });
  return feature;
}

export async function deleteFeatureAction(payload: { id: string }) {
  const user = await requireUser();
  await deleteFeature(user.id, payload.id);
  await trackEvent({ name: "feature_deleted", properties: { featureId: payload.id } });
}

export async function restoreDeletedFeatureAction(payload: { id: string }) {
  const user = await requireUser();
  const feature = await restoreFeature(user.id, payload.id);
  await trackEvent({
    name: "feature_restored",
    properties: { featureId: payload.id, ideaId: feature.ideaId },
  });
  return feature;
}

export async function reorderFeaturesAction(ideaId: string, ids: string[]) {
  const user = await requireUser();
  await reorderFeatures(user.id, ideaId, ids);
  await trackEvent({ name: "feature_reordered", properties: { ideaId, count: ids.length } });
}

export async function toggleFeatureStarAction(id: string, starred: boolean) {
  const user = await requireUser();
  const feature = await updateFeatureStar(user.id, id, starred);
  await trackEvent({
    name: starred ? "feature_starred" : "feature_unstarred",
    properties: { featureId: id, ideaId: feature.ideaId },
  });
  return feature;
}

export async function toggleFeatureCompletionAction(id: string, completed: boolean) {
  const user = await requireUser();
  const feature = await setFeatureCompletion(user.id, id, completed);
  await trackEvent({
    name: completed ? "feature_completed" : "feature_reopened",
    properties: {
      featureId: id,
      ideaId: feature.ideaId,
    },
  });
  return feature;
}

export async function listIdeaOptionsAction(excludeId?: string) {
  const user = await requireUser();
  const { items } = await listIdeas(user.id, 500, undefined, "priority");
  return items
    .filter((item) => item.id !== excludeId)
    .map((item) => ({ id: item.id, title: item.title }));
}

export async function convertIdeaToFeatureAction(input: { sourceIdeaId: string; targetIdeaId: string }) {
  const user = await requireUser();

  if (input.sourceIdeaId === input.targetIdeaId) {
    throw new Error("Choose a different idea to receive the feature.");
  }

  const sourceIdea = await getIdea(user.id, input.sourceIdeaId);
  await getIdea(user.id, input.targetIdeaId);

  const feature = await createFeature(user.id, {
    ideaId: input.targetIdeaId,
    title: sourceIdea.title,
    notes: sourceIdea.notes,
  });

  const undo = createUndoToken(input.sourceIdeaId);
  await softDeleteIdea(user.id, input.sourceIdeaId, undo.token, undo.expiresAt);

  await trackEvent({
    name: "idea_converted_to_feature",
    properties: {
      sourceIdeaId: input.sourceIdeaId,
      targetIdeaId: input.targetIdeaId,
      featureId: feature.id,
    },
  });

  return { featureId: feature.id, targetIdeaId: input.targetIdeaId };
}

export async function convertFeatureToIdeaAction(input: { featureId: string }) {
  const user = await requireUser();
  const { feature, ideaId } = await getFeatureById(user.id, input.featureId);

  const idea = await createIdea(user.id, {
    title: feature.title,
    notes: feature.notes,
  });

  await deleteFeature(user.id, input.featureId);

  await trackEvent({
    name: "feature_converted_to_idea",
    properties: {
      featureId: input.featureId,
      sourceIdeaId: ideaId,
      newIdeaId: idea.id,
    },
  });

  return { newIdeaId: idea.id };
}
