import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { ideaFeatures } from "@/lib/db/schema";
import { FEATURE_SUPER_STAR_LIMIT } from "@/lib/constants/features";
import {
  validateFeatureInput,
  validateFeatureUpdate,
  type FeatureDetailPayload,
  type FeatureInput,
  type FeatureUpdateInput,
} from "@/lib/validations/features";
import { FeatureSuperStarLimitError } from "@/lib/errors/feature-super-star-limit";
import { ensureSuperStarPlacement } from "@/lib/utils/super-star-ordering";
import { requireIdeaAccess, type IdeaAccessRecord } from "@/lib/db/access";

export type FeatureStarState = "none" | "star" | "super";

type FeatureRow = typeof ideaFeatures.$inferSelect;

type StoredFeatureDetail = {
  id: string;
  label: string;
  body: string;
  position: number;
};

const PRIVATE_FEATURE_ROLES = new Set<IdeaAccessRecord["accessRole"]>(["owner", "editor"]);

function canSeePrivateFeatures(access: IdeaAccessRecord) {
  return access.isOwner || PRIVATE_FEATURE_ROLES.has(access.accessRole);
}

function ensurePrivateVisibilityAllowed(access: IdeaAccessRecord, visibility: FeatureRow["visibility"]) {
  if (visibility === "private" && !canSeePrivateFeatures(access)) {
    throw new Error("Insufficient permissions");
  }
}

async function loadFeature(featureId: string) {
  const db = getDb();
  const [row] = await db.select().from(ideaFeatures).where(eq(ideaFeatures.id, featureId)).limit(1);
  if (!row) {
    throw new Error("Feature not found");
  }
  return { row, db } as const;
}

function getFeatureStarState(row: Pick<FeatureRow, "starred" | "superStarred">): FeatureStarState {
  if (row.superStarred) {
    return "super";
  }
  if (row.starred) {
    return "star";
  }
  return "none";
}

function resolveFeatureStarFlags(state: FeatureStarState) {
  const starred = state !== "none";
  const superStarred = state === "super";
  return {
    starred,
    superStarred,
    superStarredAt: superStarred ? new Date() : null,
  } satisfies Partial<typeof ideaFeatures.$inferInsert>;
}

export async function listFeatures(userId: string, ideaId: string) {
  const access = await requireIdeaAccess(userId, ideaId, "read", { allowPublic: true });
  const db = getDb();

  const visibilityFilter = canSeePrivateFeatures(access)
    ? and(eq(ideaFeatures.ideaId, ideaId), isNull(ideaFeatures.deletedAt))
    : and(eq(ideaFeatures.ideaId, ideaId), isNull(ideaFeatures.deletedAt), eq(ideaFeatures.visibility, "inherit"));

  const rows = await db
    .select()
    .from(ideaFeatures)
    .where(visibilityFilter)
    .orderBy(
      asc(ideaFeatures.completed),
      desc(ideaFeatures.superStarred),
      desc(ideaFeatures.starred),
      asc(ideaFeatures.position),
      desc(ideaFeatures.createdAt),
    );

  return rows.map(normalizeFeature);
}

export async function listDeletedFeatures(userId: string, ideaId: string) {
  const access = await requireIdeaAccess(userId, ideaId, "write");
  if (!canSeePrivateFeatures(access)) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(ideaFeatures)
    .where(and(eq(ideaFeatures.ideaId, ideaId), isNotNull(ideaFeatures.deletedAt)))
    .orderBy(desc(ideaFeatures.deletedAt))
    .limit(50);

  return rows.map(normalizeFeature);
}

export async function createFeature(userId: string, input: FeatureInput) {
  const payload = validateFeatureInput(input);
  const access = await requireIdeaAccess(userId, payload.ideaId, "write");
  ensurePrivateVisibilityAllowed(access, payload.visibility);

  const db = getDb();

  if (payload.superStarred) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideaFeatures)
      .where(
        and(
          eq(ideaFeatures.ideaId, payload.ideaId),
          eq(ideaFeatures.superStarred, true),
          eq(ideaFeatures.completed, false),
          isNull(ideaFeatures.deletedAt),
        ),
      );

    if (Number(count) >= FEATURE_SUPER_STAR_LIMIT) {
      throw new FeatureSuperStarLimitError();
    }
  }

  const [top] = await db
    .select({ position: ideaFeatures.position })
    .from(ideaFeatures)
    .where(eq(ideaFeatures.ideaId, payload.ideaId))
    .orderBy(asc(ideaFeatures.position))
    .limit(1);

  const position = top?.position !== undefined ? top.position - 1000 : Date.now();
  const detailSections = prepareDetailSectionsForStorage(payload.detailSections);
  const primaryDetail = detailSections[0];
  const superStarred = payload.superStarred === true;
  const starred = superStarred ? true : payload.starred;

  const [created] = await db
    .insert(ideaFeatures)
    .values({
      ideaId: payload.ideaId,
      title: payload.title,
      notes: payload.notes,
      detail: primaryDetail?.body ?? "",
      detailLabel: primaryDetail?.label ?? "Detail",
      detailSections,
      position,
      starred,
      superStarred,
      superStarredAt: superStarred ? new Date() : null,
      visibility: payload.visibility,
    })
    .returning();

  const feature = normalizeFeature(created);

  revalidatePath(`/dashboard/ideas/${payload.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function updateFeature(userId: string, input: FeatureUpdateInput) {
  const payload = validateFeatureUpdate(input);
  const { row: existing, db } = await loadFeature(payload.id);
  const access = await requireIdeaAccess(userId, existing.ideaId, "write");

  if (existing.ideaId !== payload.ideaId) {
    throw new Error("Feature not found");
  }

  ensurePrivateVisibilityAllowed(access, payload.visibility ?? existing.visibility);

  const updates: Partial<typeof ideaFeatures.$inferInsert> = { updatedAt: new Date() };
  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.notes !== undefined) updates.notes = payload.notes;

  const currentState = getFeatureStarState(existing);
  let targetState: FeatureStarState | undefined;

  if (payload.superStarred !== undefined) {
    targetState = payload.superStarred ? "super" : "none";
  }
  if (payload.starred !== undefined) {
    targetState = payload.starred ? "star" : "none";
  }
  if (payload.superStarred === true) {
    targetState = "super";
  } else if (payload.superStarred === false && payload.starred === true) {
    targetState = "star";
  }

  if (targetState !== undefined && targetState !== currentState) {
    if (targetState === "super" && !existing.superStarred) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ideaFeatures)
        .where(
          and(
            eq(ideaFeatures.ideaId, existing.ideaId),
            eq(ideaFeatures.superStarred, true),
            eq(ideaFeatures.completed, false),
            isNull(ideaFeatures.deletedAt),
          ),
        );

      if (Number(count) >= FEATURE_SUPER_STAR_LIMIT) {
        throw new FeatureSuperStarLimitError();
      }
    }

    const flags = resolveFeatureStarFlags(targetState);
    updates.starred = flags.starred;
    updates.superStarred = flags.superStarred;
    updates.superStarredAt = flags.superStarredAt;
  }

  if (payload.detailSections !== undefined) {
    const detailSections = prepareDetailSectionsForStorage(payload.detailSections);
    const primary = detailSections[0];
    updates.detailSections = detailSections;
    updates.detail = primary?.body ?? "";
    updates.detailLabel = primary?.label ?? "Detail";
  }

  if (payload.visibility !== undefined) {
    updates.visibility = payload.visibility;
  }

  const [updated] = await db
    .update(ideaFeatures)
    .set(updates)
    .where(eq(ideaFeatures.id, payload.id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${payload.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function setFeatureStarState(userId: string, id: string, state: FeatureStarState) {
  const { row: existing, db } = await loadFeature(id);
  const access = await requireIdeaAccess(userId, existing.ideaId, "write");
  ensurePrivateVisibilityAllowed(access, existing.visibility);

  if (existing.deletedAt) {
    throw new Error("Feature not found");
  }

  const currentState = getFeatureStarState(existing);
  if (state === currentState) {
    return normalizeFeature(existing);
  }

  if (state === "super" && !existing.superStarred) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideaFeatures)
      .where(
        and(
          eq(ideaFeatures.ideaId, existing.ideaId),
          eq(ideaFeatures.superStarred, true),
          eq(ideaFeatures.completed, false),
          isNull(ideaFeatures.deletedAt),
        ),
      );

    if (Number(count) >= FEATURE_SUPER_STAR_LIMIT) {
      throw new FeatureSuperStarLimitError();
    }
  }

  const flags = resolveFeatureStarFlags(state);
  const [updated] = await db
    .update(ideaFeatures)
    .set({
      starred: flags.starred,
      superStarred: flags.superStarred,
      superStarredAt: flags.superStarredAt,
      updatedAt: new Date(),
    })
    .where(eq(ideaFeatures.id, id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${feature.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function cycleFeatureStarState(userId: string, id: string) {
  const { row: existing } = await loadFeature(id);
  const next: FeatureStarState = (() => {
    const current = getFeatureStarState(existing);
    switch (current) {
      case "none":
        return "star";
      case "star":
        return "super";
      case "super":
      default:
        return "none";
    }
  })();

  return setFeatureStarState(userId, id, next);
}

export async function deleteFeature(userId: string, id: string) {
  const { row: existing, db } = await loadFeature(id);
  const access = await requireIdeaAccess(userId, existing.ideaId, "write");
  ensurePrivateVisibilityAllowed(access, existing.visibility);

  if (existing.deletedAt) {
    return normalizeFeature(existing);
  }

  const [updated] = await db
    .update(ideaFeatures)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(ideaFeatures.id, id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${feature.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function restoreFeature(userId: string, id: string) {
  const { row: existing, db } = await loadFeature(id);
  const access = await requireIdeaAccess(userId, existing.ideaId, "write");
  ensurePrivateVisibilityAllowed(access, existing.visibility);

  if (!existing.deletedAt) {
    return normalizeFeature(existing);
  }

  const [updated] = await db
    .update(ideaFeatures)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(ideaFeatures.id, id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${feature.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function setFeatureCompletion(userId: string, id: string, completed: boolean) {
  const { row: existing, db } = await loadFeature(id);
  const access = await requireIdeaAccess(userId, existing.ideaId, "write");
  ensurePrivateVisibilityAllowed(access, existing.visibility);

  if (existing.deletedAt) {
    throw new Error("Feature not found");
  }

  const nextFlags: Partial<typeof ideaFeatures.$inferInsert> = completed
    ? {
        starred: false,
        superStarred: false,
        superStarredAt: null,
      }
    : {};

  const [updated] = await db
    .update(ideaFeatures)
    .set({
      completed,
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
      ...nextFlags,
    })
    .where(eq(ideaFeatures.id, id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${feature.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function getFeatureById(userId: string, id: string) {
  const { row: existing } = await loadFeature(id);
  const access = await requireIdeaAccess(userId, existing.ideaId, "read", { allowPublic: true });
  if (existing.deletedAt) {
    throw new Error("Feature not found");
  }
  if (existing.visibility === "private" && !canSeePrivateFeatures(access)) {
    throw new Error("Feature not found");
  }

  return {
    feature: normalizeFeature(existing),
    ideaId: existing.ideaId,
  };
}

export async function reorderFeatures(userId: string, ideaId: string, orderedIds: string[]) {
  if (orderedIds.length === 0) {
    return;
  }

  await requireIdeaAccess(userId, ideaId, "write");

  const db = getDb();

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: ideaFeatures.id, superStarred: ideaFeatures.superStarred })
      .from(ideaFeatures)
      .where(
        and(
          eq(ideaFeatures.ideaId, ideaId),
          isNull(ideaFeatures.deletedAt),
          eq(ideaFeatures.completed, false),
        ),
      );

    const existingIds = new Set(rows.map((row) => row.id));
    if (existingIds.size !== orderedIds.length) {
      throw new Error("Reorder payload must include all features");
    }

    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw new Error("Cannot reorder features you do not own");
      }
    }

    const superStarIds = rows.filter((row) => row.superStarred).map((row) => row.id);
    ensureSuperStarPlacement(orderedIds, superStarIds);

    await Promise.all(
      orderedIds.map((id, index) =>
        tx.update(ideaFeatures).set({ position: (index + 1) * 1000 }).where(eq(ideaFeatures.id, id)),
      ),
    );
  });

  revalidatePath(`/dashboard/ideas/${ideaId}`);
  revalidatePath("/dashboard/ideas");
}

export type FeatureDetailRecord = StoredFeatureDetail;
export type FeatureRecord = ReturnType<typeof normalizeFeature>;

function prepareDetailSectionsForStorage(sections: FeatureDetailPayload[]): StoredFeatureDetail[] {
  return sections.map((section, index) => ({
    id: section.id ?? randomUUID(),
    label: section.label,
    body: section.body,
    position: (index + 1) * 1000,
  }));
}

function parseStoredDetailSections(value: unknown): StoredFeatureDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: StoredFeatureDetail[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const candidate = item as Record<string, unknown>;
    const id =
      typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : randomUUID();
    const labelValue =
      typeof candidate.label === "string" && candidate.label.trim().length > 0 ? candidate.label : "Detail";
    const bodyValue = typeof candidate.body === "string" ? candidate.body : "";
    const positionValue =
      typeof candidate.position === "number" && Number.isFinite(candidate.position)
        ? (candidate.position as number)
        : (index + 1) * 1000;
    records.push({
      id,
      label: labelValue,
      body: bodyValue,
      position: positionValue,
    });
  });
  records.sort((a, b) => a.position - b.position);
  return records;
}

function normalizeFeature(row: FeatureRow) {
  const detailSections = parseStoredDetailSections(row.detailSections);
  const primary = detailSections[0];

  return {
    ...row,
    detail: primary?.body ?? "",
    detailLabel: primary?.label ?? "Detail",
    detailSections,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
    completed: Boolean(row.completed),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    starred: Boolean(row.starred),
    superStarred: Boolean(row.superStarred),
    superStarredAt: row.superStarredAt ? row.superStarredAt.toISOString() : null,
    visibility: row.visibility,
  };
}
