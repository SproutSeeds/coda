"use server";

import { redirect } from "next/navigation";

import { createIdea, listDeletedIdeas, listIdeas, purgeIdea, reorderIdeas, restoreIdea, searchIdeas, softDeleteIdea, updateIdea } from "@/lib/db/ideas";
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

export async function updateIdeaAction(input: { id: string; title?: string; notes?: string; updatedAt: string }) {
  const user = await requireUser();
  const idea = await updateIdea(user.id, input.id, {
    title: input.title,
    notes: input.notes,
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

export async function loadIdeas(searchParams: { q?: string; cursor?: string }) {
  const user = await requireUser();
  if (searchParams.q) {
    return {
      items: await searchIdeas(user.id, searchParams.q),
      nextCursor: null,
    };
  }
  return listIdeas(user.id, 100, searchParams.cursor);
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
