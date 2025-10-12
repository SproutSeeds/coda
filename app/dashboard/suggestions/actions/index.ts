"use server";

import { redirect } from "next/navigation";

import {
  createSuggestion,
  createSuggestionUpdate,
  getSuggestion,
  getSuggestionForSubmitter,
  listDeletedSuggestions,
  listSuggestionUpdates,
  listSuggestions,
  listSuggestionsForSubmitter,
  purgeSuggestion,
  reorderSuggestions,
  resolveDeveloperId,
  restoreSuggestion,
  searchSuggestions,
  softDeleteSuggestion,
  updateSuggestion,
  updateSuggestionStar,
  setSuggestionCompletion,
  type SuggestionSort,
} from "@/lib/db/suggestions";
import { trackEvent } from "@/lib/utils/analytics";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { consumeUndoToken, createUndoToken } from "@/lib/utils/undo";
import { requireUser } from "@/lib/auth/session";
import { DEVELOPER_EMAIL } from "@/lib/constants";

async function requireDeveloper() {
  const user = await requireUser();
  if (!user.email || user.email.toLowerCase() !== DEVELOPER_EMAIL.toLowerCase()) {
    throw new Error("Unauthorized");
  }
  const developerId = await resolveDeveloperId(DEVELOPER_EMAIL);
  if (!developerId) {
    throw new Error("Developer account not provisioned");
  }
  return { user, developerId } as const;
}

async function getDeveloperId() {
  const developerId = await resolveDeveloperId(DEVELOPER_EMAIL);
  if (!developerId) {
    throw new Error("Suggestion box unavailable");
  }
  return developerId;
}

export async function createSuggestionAction(formData: FormData | { title: string; notes: string }) {
  const user = await requireUser();
  const key = `${user.id}:suggestion:create`;
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

  const developerId = await getDeveloperId();
  const suggestion = await createSuggestion(developerId, user.id, user.email ?? null, payload);
  await trackEvent({ name: "suggestion_created", properties: { suggestionId: suggestion.id } });
  return suggestion;
}

export async function updateSuggestionAction(input: { id: string; title?: string; notes?: string; updatedAt: string }) {
  const { developerId } = await requireDeveloper();
  const suggestion = await updateSuggestion(developerId, input.id, {
    title: input.title,
    notes: input.notes,
    updatedAt: new Date(input.updatedAt),
  });
  await trackEvent({ name: "suggestion_updated", properties: { suggestionId: suggestion.id } });
  return suggestion;
}

export async function deleteSuggestionAction(input: { id: string }) {
  const { developerId } = await requireDeveloper();
  const undo = createUndoToken(input.id);
  await softDeleteSuggestion(developerId, input.id, undo.token, undo.expiresAt);
  await trackEvent({ name: "suggestion_deleted", properties: { suggestionId: input.id } });
  return { undoToken: undo.token, expiresAt: undo.expiresAt.toISOString() };
}

export async function restoreSuggestionAction(input: { id: string; token: string }) {
  const { developerId } = await requireDeveloper();
  const record = consumeUndoToken(input.token);
  if (!record || record.ideaId !== input.id) {
    throw new Error("Undo token expired");
  }
  const suggestion = await restoreSuggestion(developerId, input.id);
  await trackEvent({ name: "suggestion_restored", properties: { suggestionId: suggestion.id } });
  return suggestion;
}

export async function purgeSuggestionAction(id: string) {
  const { developerId } = await requireDeveloper();
  await purgeSuggestion(developerId, id);
  await trackEvent({ name: "suggestion_purged", properties: { suggestionId: id } });
}

export async function restoreDeletedSuggestionAction(id: string) {
  const { developerId } = await requireDeveloper();
  const suggestion = await restoreSuggestion(developerId, id);
  await trackEvent({ name: "suggestion_restored", properties: { suggestionId: suggestion.id, source: "recently_deleted" } });
  return suggestion;
}

export async function toggleSuggestionStarAction(id: string, starred: boolean) {
  const { developerId } = await requireDeveloper();
  const suggestion = await updateSuggestionStar(developerId, id, starred);
  await trackEvent({ name: starred ? "suggestion_starred" : "suggestion_unstarred", properties: { suggestionId: id } });
  return suggestion;
}

export async function reorderSuggestionsAction(ids: string[]) {
  const { developerId } = await requireDeveloper();
  await reorderSuggestions(developerId, ids);
  await trackEvent({ name: "suggestion_reordered", properties: { count: ids.length } });
}

export async function loadMySuggestionsAction() {
  const user = await requireUser();
  return listSuggestionsForSubmitter(user.id, user.email ?? null);
}

export async function setSuggestionCompletionAction(input: { id: string; completed: boolean }) {
  const { developerId } = await requireDeveloper();
  const suggestion = await setSuggestionCompletion(developerId, input.id, input.completed);
  await trackEvent({ name: input.completed ? "suggestion_completed" : "suggestion_reopened", properties: { suggestionId: suggestion.id } });
  return suggestion;
}

export async function loadSuggestions(searchParams: { q?: string; cursor?: string; sort?: SuggestionSort }) {
  const { developerId } = await requireDeveloper();
  if (searchParams.q) {
    return {
      items: await searchSuggestions(developerId, searchParams.q),
      nextCursor: null,
    };
  }
  const allowedSorts: SuggestionSort[] = ["priority", "created_desc", "updated_desc", "title_asc"];
  const sort = searchParams.sort && allowedSorts.includes(searchParams.sort) ? searchParams.sort : "priority";
  return listSuggestions(developerId, 100, searchParams.cursor, sort);
}

export async function loadSuggestion(id: string) {
  const { developerId } = await requireDeveloper();
  return getSuggestion(developerId, id);
}

export async function loadDeletedSuggestionsAction() {
  const { developerId } = await requireDeveloper();
  return listDeletedSuggestions(developerId);
}

export async function searchSuggestionsAction(query: string) {
  const { developerId } = await requireDeveloper();
  const rate = await consumeRateLimit(`${developerId}:suggestion:search`);
  if (!rate.success) {
    throw new Error("Rate limit exceeded. Please try again shortly.");
  }
  return searchSuggestions(developerId, query);
}

export async function requireDeveloperAccessOrRedirect() {
  const user = await requireUser();
  if (user.email?.toLowerCase() !== DEVELOPER_EMAIL.toLowerCase()) {
    redirect("/dashboard/ideas");
  }
}

export async function loadSuggestionDetailAction(id: string) {
  const user = await requireUser();
  const developerId = await resolveDeveloperId(DEVELOPER_EMAIL);
  if (!developerId) {
    throw new Error("Suggestion box unavailable");
  }

  const isDeveloper = user.email?.toLowerCase() === DEVELOPER_EMAIL.toLowerCase();
  if (process.env.NODE_ENV !== "production") {
    console.info("[suggestions] detail access", {
      viewerId: user.id,
      viewerEmail: user.email ?? null,
      developerEmail: DEVELOPER_EMAIL,
      developerId,
      isDeveloper,
    });
  }
  const suggestion = isDeveloper
    ? await getSuggestion(developerId, id)
    : await getSuggestionForSubmitter(user.id, user.email ?? null, id);

  const updates = await listSuggestionUpdates(id);
  return { suggestion, updates, isDeveloper, viewerEmail: user.email ?? null } as const;
}

export async function createSuggestionUpdateAction(input: { suggestionId: string; body: string }) {
  const { user } = await requireDeveloper();
  const trimmed = input.body.trim();
  if (!trimmed) {
    throw new Error("Update cannot be empty.");
  }
  const update = await createSuggestionUpdate(input.suggestionId, user.id, user.email ?? null, trimmed);
  await trackEvent({ name: "suggestion_update_created", properties: { suggestionId: input.suggestionId, updateId: update.id } });
  return update;
}
