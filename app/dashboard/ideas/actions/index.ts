"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import {
  createFeature,
  deleteFeature,
  getFeatureById,
  listDeletedFeatures,
  listFeatures,
  reorderFeatures,
  restoreFeature,
  setFeatureCompletion,
  cycleFeatureStarState,
  updateFeature,
} from "@/lib/db/features";
import type { FeatureRecord } from "@/lib/db/features";
import {
  createIdea,
  cycleIdeaStarState,
  getIdea,
  listDeletedIdeas,
  listIdeas,
  reorderIdeas,
  updateIdea,
  purgeIdea,
  restoreIdea,
  searchIdeas,
  softDeleteIdea,
  type IdeaRecord,
  type IdeaSort,
} from "@/lib/db/ideas";
import {
  acceptIdeaCollaboratorInvite,
  inviteCollaborator,
  leaveIdea,
  listIdeaCollaboratorInvites,
  listIdeaCollaborators,
  removeIdeaCollaborator,
  revokeIdeaCollaboratorInvite,
  updateIdeaCollaboratorRole,
} from "@/lib/db/collaborators";
import type { IdeaCollaboratorInviteSummary, IdeaCollaboratorSummary } from "@/lib/db/collaborators";
import {
  listExistingCollaboratorIds,
  resolveCollaboratorEmailStatus,
  searchAccountDirectory,
} from "@/lib/db/users";
import {
  archiveJoinRequest,
  createJoinRequest,
  getJoinRequestCounts,
  getJoinRequestForApplicant,
  getPendingJoinRequest,
  listJoinRequestsForOwner,
  markJoinRequestsSeen,
  resolveJoinRequest,
  updateJoinRequestReaction,
} from "@/lib/db/join-requests";
import type { IdeaJoinRequestRecord, JoinRequestCounts, ResolveJoinRequestInput } from "@/lib/db/join-requests";
import { getIdeaAccess, requireIdeaAccess } from "@/lib/db/access";
import { SuperStarLimitError } from "@/lib/errors/super-star-limit";
import { FeatureSuperStarLimitError } from "@/lib/errors/feature-super-star-limit";
import { trackEvent } from "@/lib/utils/analytics";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { consumeUndoToken, createUndoToken } from "@/lib/utils/undo";
import { requireUser } from "@/lib/auth/session";
import {
  normalizeCollaboratorEmail,
  validateCollaboratorDirectoryLookup,
  validateCollaboratorInviteInput,
} from "@/lib/validations/collaborators";
import {
  validateJoinRequestInput,
  validateJoinRequestReactionInput,
  validateMarkJoinRequestsSeenInput,
  validateResolveJoinRequestInput,
  type ResolveJoinRequestActionInput,
} from "@/lib/validations/join-requests";
import { importIdeasAction } from "./import";

export { importIdeasAction };

export async function createIdeaAction(
  formData: FormData | { title: string; notes: string; visibility?: "private" | "public" },
) {
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
        visibility: (() => {
          const value = formData.get("visibility");
          if (value === "private") return "private" as const;
          if (value === "public") return "public" as const;
          if (typeof value === "string") {
            const normalized = value.toLowerCase();
            if (normalized === "private") return "private" as const;
            if (normalized === "public") return "public" as const;
          }
          return undefined;
        })(),
      }
    : formData;

  const idea = await createIdea(user.id, payload);
  await trackEvent({ name: "idea_created", properties: { ideaId: idea.id } });
  return idea;
}

export async function updateIdeaAction(input: {
  id: string;
  title?: string;
  notes?: string;
  githubUrl?: string | null;
  linkLabel?: string | null;
  visibility?: "private" | "public";
  updatedAt: string;
}) {
  const user = await requireUser();
  const idea = await updateIdea(user.id, input.id, {
    title: input.title,
    notes: input.notes,
    githubUrl: input.githubUrl,
    linkLabel: input.linkLabel,
    visibility: input.visibility,
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
    const items = await searchIdeas(user.id, searchParams.q);
    return {
      items,
      nextCursor: null,
      viewerId: user.id,
    };
  }
  const allowedSorts: IdeaSort[] = ["priority", "created_desc", "updated_desc", "title_asc"];
  const sort = searchParams.sort && allowedSorts.includes(searchParams.sort) ? searchParams.sort : "priority";
  const result = await listIdeas(user.id, 100, searchParams.cursor, sort);
  return {
    ...result,
    viewerId: user.id,
  };
}

export async function loadIdea(id: string) {
  const user = await requireUser();
  return getIdea(user.id, id);
}

export async function loadIdeaWithFeatures(id: string) {
  const user = await requireUser();
  const idea = await getIdea(user.id, id);
  const joinRequestCountsPromise: Promise<JoinRequestCounts | null> = idea.isOwner
    ? getJoinRequestCounts(user.id, id)
    : Promise.resolve<JoinRequestCounts | null>(null);
  const [features, deletedFeatures, viewerJoinRequest, ownerJoinRequestCounts] = await Promise.all([
    listFeatures(user.id, id),
    idea.isOwner || idea.accessRole === "editor" ? listDeletedFeatures(user.id, id) : Promise.resolve([]),
    getJoinRequestForApplicant(user.id, id),
    joinRequestCountsPromise,
  ]);
  return { idea, features, deletedFeatures, viewerJoinRequest, ownerJoinRequestCounts };
}

export async function listJoinRequestsAction(ideaId: string) {
  const user = await requireUser();
  const [requests, counts] = await Promise.all([
    listJoinRequestsForOwner(user.id, ideaId, { includeArchived: false, includeProcessed: true }),
    getJoinRequestCounts(user.id, ideaId),
  ]);

  await trackEvent({
    name: "idea_join_requests_viewed",
    properties: { ideaId, pending: counts.pending, unseen: counts.unseen },
  });

  return { requests, counts };
}

export async function markJoinRequestsSeenAction(input: { ideaId: string; requestIds?: string[] }) {
  const user = await requireUser();
  const payload = validateMarkJoinRequestsSeenInput(input);
  await markJoinRequestsSeen(user.id, payload.ideaId, payload.requestIds);
  const counts = await getJoinRequestCounts(user.id, payload.ideaId);

  await trackEvent({
    name: "idea_join_requests_marked_seen",
    properties: { ideaId: payload.ideaId, requestCount: payload.requestIds?.length ?? null },
  });

  return counts;
}

export async function resolveJoinRequestAction(input: ResolveJoinRequestActionInput) {
  const user = await requireUser();
  const payload = validateResolveJoinRequestInput(input);
  const resolveInput: ResolveJoinRequestInput = {
    status: payload.status,
    note: payload.note ?? null,
  };
  const resolvedGrantRole = payload.grantRole ?? (payload.status === "approved" ? "editor" : undefined);
  if (resolvedGrantRole) {
    resolveInput.grantRole = resolvedGrantRole;
  }

  const result = await resolveJoinRequest(user.id, payload.requestId, resolveInput);
  const counts = await getJoinRequestCounts(user.id, result.request.ideaId);

  await trackEvent({
    name: "idea_join_request_resolved",
    properties: {
      ideaId: result.request.ideaId,
      requestId: result.request.id,
      status: payload.status,
      grantRole: payload.status === "approved" ? payload.grantRole ?? "editor" : null,
    },
  });

  return { ...result, counts };
}

export async function updateJoinRequestReactionAction(input: { requestId: string; reaction: string | null }) {
  const user = await requireUser();
  const payload = validateJoinRequestReactionInput(input);
  const request = await updateJoinRequestReaction(user.id, payload.requestId, payload.reaction);

  await trackEvent({
    name: "idea_join_request_reacted",
    properties: {
      ideaId: request.ideaId,
      requestId: request.id,
      reaction: payload.reaction,
    },
  });

  return request;
}

export async function archiveJoinRequestAction(requestId: string) {
  const user = await requireUser();
  const request = await archiveJoinRequest(user.id, requestId);
  const counts = await getJoinRequestCounts(user.id, request.ideaId);

  await trackEvent({
    name: "idea_join_request_archived",
    properties: {
      ideaId: request.ideaId,
      requestId,
    },
  });

  return { request, counts };
}

type IdeaCollaboratorDirectory = {
  collaborators: IdeaCollaboratorSummary[];
  invites: IdeaCollaboratorInviteSummary[];
};

export async function loadIdeaCollaboratorsAction(ideaId: string): Promise<IdeaCollaboratorDirectory> {
  const user = await requireUser();
  const [collaborators, invites] = await Promise.all([
    listIdeaCollaborators(user.id, ideaId),
    listIdeaCollaboratorInvites(user.id, ideaId),
  ]);
  return { collaborators, invites };
}

export async function lookupCollaboratorEmailAction(input: { ideaId: string; email: string }) {
  const user = await requireUser();
  const ideaId = input.ideaId;
  const normalizedEmail = normalizeCollaboratorEmail(input.email ?? "");

  try {
    validateCollaboratorInviteInput({ email: normalizedEmail, role: "viewer" });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message ?? "Enter a valid email address" : "Enter a valid email address";
    return { email: normalizedEmail, error: message, status: "invalid" as const };
  }

  await requireIdeaAccess(user.id, ideaId, "owner");
  const resolution = await resolveCollaboratorEmailStatus(ideaId, normalizedEmail);
  return { email: normalizedEmail, status: resolution.status, resolution };
}

export async function searchCollaboratorDirectoryAction(input: { ideaId: string; query: string; limit?: number }) {
  const user = await requireUser();
  const payload = validateCollaboratorDirectoryLookup(input);
  await requireIdeaAccess(user.id, payload.ideaId, "owner");

  const skipUserIds = await listExistingCollaboratorIds(payload.ideaId);
  if (!skipUserIds.includes(user.id)) {
    skipUserIds.push(user.id);
  }

  const matches = await searchAccountDirectory({
    ideaId: payload.ideaId,
    search: payload.query,
    limit: payload.limit,
    skipUserIds,
  });

  return matches;
}

export async function inviteIdeaCollaboratorAction(input: { ideaId: string; email: string; role: "editor" | "commenter" | "viewer" }) {
  const user = await requireUser();
  const result = await inviteCollaborator(user.id, input.ideaId, { email: input.email, role: input.role });
  await trackEvent({ name: "idea_collaborator_invited", properties: { ideaId: input.ideaId, role: input.role, type: result.type } });
  return result;
}

export async function updateIdeaCollaboratorRoleAction(input: { ideaId: string; collaboratorId: string; role: "editor" | "commenter" | "viewer" }) {
  const user = await requireUser();
  const collaborator = await updateIdeaCollaboratorRole(user.id, input.ideaId, input.collaboratorId, { role: input.role });
  await trackEvent({ name: "idea_collaborator_role_updated", properties: { ideaId: input.ideaId, collaboratorId: input.collaboratorId, role: input.role } });
  return collaborator;
}

export async function removeIdeaCollaboratorAction(input: { ideaId: string; collaboratorId: string }) {
  const user = await requireUser();
  await removeIdeaCollaborator(user.id, input.ideaId, input.collaboratorId);
  await trackEvent({ name: "idea_collaborator_removed", properties: { ideaId: input.ideaId, collaboratorId: input.collaboratorId } });
}

export async function revokeIdeaCollaboratorInviteAction(input: { ideaId: string; inviteId: string }) {
  const user = await requireUser();
  await revokeIdeaCollaboratorInvite(user.id, input.ideaId, input.inviteId);
  await trackEvent({ name: "idea_collaborator_invite_revoked", properties: { ideaId: input.ideaId, inviteId: input.inviteId } });
}

export async function leaveIdeaAction(ideaId: string) {
  const user = await requireUser();
  await leaveIdea(user.id, ideaId);
  await trackEvent({ name: "idea_collaborator_left", properties: { ideaId } });
}

export type SubmitJoinRequestResult =
  | { success: true; request: IdeaJoinRequestRecord }
  | {
      success: false;
      error: string;
      code: "request-exists" | "already-on-team" | "not-public";
      request?: IdeaJoinRequestRecord | null;
    };

export async function submitJoinRequestAction(input: { ideaId: string; message: string }): Promise<SubmitJoinRequestResult> {
  const user = await requireUser();
  const payload = validateJoinRequestInput(input);
  const access = await getIdeaAccess(user.id, payload.ideaId, { allowPublic: true });

  if (!access) {
    throw new Error("Idea not found");
  }

  if (access.idea.visibility !== "public") {
    return { success: false, error: "This idea is not open to the public yet.", code: "not-public" };
  }

  if (access.isOwner || access.accessRole === "owner" || access.accessRole === "editor" || access.accessRole === "commenter") {
    return { success: false, error: "You’re already part of this team.", code: "already-on-team" };
  }

  const pending = await getPendingJoinRequest(user.id, payload.ideaId);
  if (pending) {
    return { success: false, error: "You already have a pending request.", code: "request-exists", request: pending };
  }

  const rate = await consumeRateLimit(`${user.id}:join-request:${payload.ideaId}`);
  if (!rate.success) {
    throw new Error("Slow down—give the team a moment to respond before sending another request.");
  }

  const request = await createJoinRequest(user.id, payload.ideaId, payload.message);
  await trackEvent({
    name: "idea_join_request_created",
    properties: { ideaId: payload.ideaId },
  });

  return { success: true, request };
}

export async function acceptIdeaCollaboratorInviteAction(token: string) {
  const user = await requireUser();
  const ideaId = await acceptIdeaCollaboratorInvite(user.id, token);
  await trackEvent({ name: "idea_collaborator_joined", properties: { ideaId, inviteToken: token } });
  return { ideaId };
}

type IdeaExportBundle = {
  idea: IdeaRecord;
  features: Awaited<ReturnType<typeof listFeatures>>;
};

function buildIdeaExportEnvelope(bundles: IdeaExportBundle[], exportedAt: Date) {
  return {
    schemaVersion: 1,
    exportedAt: exportedAt.toISOString(),
    ideaCount: bundles.length,
    featureCount: bundles.reduce((total, bundle) => total + bundle.features.length, 0),
    ideas: bundles,
  };
}

async function fetchIdeaBundle(userId: string, ideaId: string): Promise<IdeaExportBundle> {
  const idea = await getIdea(userId, ideaId);
  const features = await listFeatures(userId, ideaId);
  return { idea, features };
}

export async function exportIdeaAsJsonAction(id: string) {
  const user = await requireUser();
  const exportedAt = new Date();
  const bundle = await fetchIdeaBundle(user.id, id);
  return buildIdeaExportEnvelope([bundle], exportedAt);
}

export async function exportAllIdeasAsJsonAction() {
  const user = await requireUser();
  const pageSize = 200;
  let cursor: string | undefined;
  const bundles: IdeaExportBundle[] = [];
  const exportedAt = new Date();

  while (true) {
    const { items, nextCursor } = await listIdeas(user.id, pageSize, cursor, "priority");
    if (items.length === 0) {
      break;
    }

    const featureBatches = await Promise.all(items.map((idea) => listFeatures(user.id, idea.id)));
    items.forEach((idea, index) => {
      bundles.push({
        idea,
        features: featureBatches[index] ?? [],
      });
    });

    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return buildIdeaExportEnvelope(bundles, exportedAt);
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

type CycleIdeaStarActionResult =
  | { success: true; idea: IdeaRecord }
  | { success: false; error: string; code: "idea-super-star-limit" };

export async function cycleIdeaStarAction(id: string): Promise<CycleIdeaStarActionResult> {
  const user = await requireUser();
  try {
    const idea = await cycleIdeaStarState(user.id, id);
    const eventName = idea.superStarred
      ? "idea_super_starred"
      : idea.starred
        ? "idea_starred"
        : "idea_unstarred";
    await trackEvent({
      name: eventName,
      properties: { ideaId: id },
    });
    return { success: true, idea };
  } catch (error) {
    if (error instanceof SuperStarLimitError) {
      return {
        success: false,
        error: error.message,
        code: "idea-super-star-limit",
      };
    }
    throw error instanceof Error ? error : new Error("Unable to update star state");
  }
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

export async function createFeatureAction(
  formData:
    | FormData
    | {
        ideaId: string;
        title: string;
        notes: string;
        detail?: string;
        detailLabel?: string;
        details?: { id?: string; label?: string; body?: string }[];
        starred?: boolean;
        superStarred?: boolean;
        visibility?: "inherit" | "private";
      },
) {
  const user = await requireUser();
  const payload = formData instanceof FormData
    ? {
        ideaId: String(formData.get("ideaId") ?? ""),
        title: String(formData.get("title") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        detailLabel: String(formData.get("detailLabel") ?? ""),
        detail: String(formData.get("detail") ?? ""),
        visibility: (() => {
          const value = formData.get("visibility");
          if (value === "private") return "private" as const;
          if (value === "inherit") return "inherit" as const;
          if (typeof value === "string") {
            const normalized = value.toLowerCase();
            if (normalized === "private") return "private" as const;
            if (normalized === "inherit") return "inherit" as const;
          }
          return undefined;
        })(),
        starred: (() => {
          const value = formData.get("starred");
          if (value == null) return false;
          const normalized = String(value).toLowerCase();
          return normalized === "true" || normalized === "on" || normalized === "1";
        })(),
        superStarred: (() => {
          const value = formData.get("superStarred");
          if (value == null) return false;
          const normalized = String(value).toLowerCase();
          return normalized === "true" || normalized === "on" || normalized === "1";
        })(),
      }
    : formData;

  const feature = await createFeature(user.id, payload);
  await trackEvent({
    name: "feature_created",
    properties: {
      ideaId: payload.ideaId,
      featureId: feature.id,
      starred: payload.starred ?? false,
      superStarred: payload.superStarred ?? false,
    },
  });
  if (payload.superStarred) {
    await trackEvent({
      name: "feature_super_starred",
      properties: { featureId: feature.id, ideaId: payload.ideaId },
    });
  } else if (payload.starred) {
    await trackEvent({
      name: "feature_starred",
      properties: { featureId: feature.id, ideaId: payload.ideaId },
    });
  }
  return feature;
}

export async function updateFeatureAction(payload: {
  id: string;
  ideaId: string;
  title?: string;
  notes?: string;
  detail?: string;
  detailLabel?: string;
  details?: { id?: string; label?: string; body?: string }[];
  visibility?: "inherit" | "private";
}) {
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

type CycleFeatureStarActionResult =
  | { success: true; feature: FeatureRecord }
  | { success: false; error: string; code: "feature-super-star-limit" };

export async function cycleFeatureStarAction(id: string): Promise<CycleFeatureStarActionResult> {
  const user = await requireUser();
  try {
    const feature = await cycleFeatureStarState(user.id, id);
    const eventName = feature.superStarred
      ? "feature_super_starred"
      : feature.starred
        ? "feature_starred"
        : "feature_unstarred";

    await trackEvent({
      name: eventName,
      properties: { featureId: id, ideaId: feature.ideaId },
    });

    return { success: true, feature };
  } catch (error) {
    if (error instanceof FeatureSuperStarLimitError) {
      return {
        success: false,
        error: error.message,
        code: "feature-super-star-limit",
      };
    }
    throw error;
  }
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
    notes: (() => {
      const detailMarkdown = feature.detailSections
        .filter((section) => section.body.trim())
        .map((section) => `**${section.label || "Detail"}**\n\n${section.body}`)
        .join("\n\n---\n\n");
      if (!detailMarkdown) {
        return feature.notes;
      }
      const baseNotes = feature.notes?.trim() ?? "";
      return baseNotes ? `${baseNotes}\n\n---\n\n${detailMarkdown}` : detailMarkdown;
    })(),
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
