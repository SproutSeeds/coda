"use server";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { ideaFeatures, ideas } from "@/lib/db/schema";
import {
  validateFeatureInput,
  validateFeatureUpdate,
  type FeatureDetailPayload,
  type FeatureInput,
  type FeatureUpdateInput,
} from "@/lib/validations/features";
import { FeatureSuperStarLimitError } from "@/lib/errors/feature-super-star-limit";
import { ensureSuperStarPlacement } from "@/lib/utils/super-star-ordering";

const FEATURE_SUPER_STAR_LIMIT = 3;

export type FeatureStarState = "none" | "star" | "super";

function getFeatureStarState(row: Pick<typeof ideaFeatures.$inferSelect, "starred" | "superStarred">): FeatureStarState {
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
  const db = getDb();

  const rows = await db
    .select({ feature: ideaFeatures })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(
      and(
        eq(ideas.userId, userId),
        eq(ideaFeatures.ideaId, ideaId),
        isNull(ideas.deletedAt),
        isNull(ideaFeatures.deletedAt),
      ),
    )
    .orderBy(
      asc(ideaFeatures.completed),
      desc(ideaFeatures.superStarred),
      desc(ideaFeatures.starred),
      asc(ideaFeatures.position),
      desc(ideaFeatures.createdAt),
    );

  return rows.map((row) => normalizeFeature(row.feature));
}

export async function listDeletedFeatures(userId: string, ideaId: string) {
  const db = getDb();

  const rows = await db
    .select({ feature: ideaFeatures })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(
      and(
        eq(ideas.userId, userId),
        eq(ideaFeatures.ideaId, ideaId),
        isNull(ideas.deletedAt),
        isNotNull(ideaFeatures.deletedAt),
      ),
    )
    .orderBy(desc(ideaFeatures.deletedAt))
    .limit(50);

  return rows.map((row) => normalizeFeature(row.feature));
}

export async function createFeature(userId: string, input: FeatureInput) {
  const payload = validateFeatureInput(input);
  const db = getDb();

  const [owner] = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(and(eq(ideas.id, payload.ideaId), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!owner) {
    throw new Error("Idea not found");
  }

  if (payload.superStarred) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ideaFeatures)
      .where(
        and(
          eq(ideaFeatures.ideaId, payload.ideaId),
          eq(ideaFeatures.superStarred, true),
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
    })
    .returning();

  const feature = normalizeFeature(created);

  revalidatePath(`/dashboard/ideas/${payload.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function updateFeature(userId: string, input: FeatureUpdateInput) {
  const payload = validateFeatureUpdate(input);
  const db = getDb();

  const [existing] = await db
    .select({
      id: ideaFeatures.id,
      ideaId: ideaFeatures.ideaId,
      updatedAt: ideaFeatures.updatedAt,
      starred: ideaFeatures.starred,
      superStarred: ideaFeatures.superStarred,
    })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideaFeatures.id, payload.id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing || existing.ideaId !== payload.ideaId) {
    throw new Error("Feature not found");
  }

  const updates: Partial<typeof ideaFeatures.$inferInsert> = { updatedAt: new Date() };
  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.notes !== undefined) updates.notes = payload.notes;
  const currentStarState = getFeatureStarState({
    starred: existing.starred,
    superStarred: existing.superStarred,
  });

  const superFlag = payload.superStarred;
  const starFlag = payload.starred;
  let targetState: FeatureStarState | undefined;

  if (superFlag !== undefined) {
    targetState = superFlag ? "super" : "none";
  }
  if (starFlag !== undefined) {
    targetState = starFlag ? "star" : "none";
  }
  if (superFlag === true) {
    targetState = "super";
  } else if (superFlag === false && starFlag === true) {
    targetState = "star";
  }

  if (targetState !== undefined && targetState !== currentStarState) {
    if (targetState === "super" && !existing.superStarred) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ideaFeatures)
        .where(
          and(
            eq(ideaFeatures.ideaId, existing.ideaId),
            eq(ideaFeatures.superStarred, true),
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
  const db = getDb();

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        feature: ideaFeatures,
        ideaId: ideaFeatures.ideaId,
      })
      .from(ideaFeatures)
      .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
      .where(and(eq(ideaFeatures.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new Error("Feature not found");
    }

    const currentState = getFeatureStarState(existing.feature);
    if (state === currentState) {
      return existing.feature;
    }

    if (state === "super" && !existing.feature.superStarred) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(ideaFeatures)
        .where(
          and(
            eq(ideaFeatures.ideaId, existing.ideaId),
            eq(ideaFeatures.superStarred, true),
            isNull(ideaFeatures.deletedAt),
          ),
        );

      if (Number(count) >= FEATURE_SUPER_STAR_LIMIT) {
        throw new FeatureSuperStarLimitError();
      }
    }

    const flags = resolveFeatureStarFlags(state);
    const [next] = await tx
      .update(ideaFeatures)
      .set({
        starred: flags.starred,
        superStarred: flags.superStarred,
        superStarredAt: flags.superStarredAt,
        updatedAt: new Date(),
      })
      .where(eq(ideaFeatures.id, id))
      .returning();

    return next;
  });

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${feature.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function cycleFeatureStarState(userId: string, id: string) {
  const db = getDb();
  const [existing] = await db
    .select({
      feature: ideaFeatures,
      ideaId: ideaFeatures.ideaId,
    })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideaFeatures.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Feature not found");
  }

  const currentState = getFeatureStarState(existing.feature);
  const nextState: FeatureStarState =
    currentState === "none" ? "star" : currentState === "star" ? "super" : "none";

  return setFeatureStarState(userId, id, nextState);
}

export async function deleteFeature(userId: string, id: string) {
  const db = getDb();

  const [existing] = await db
    .select({ id: ideaFeatures.id, ideaId: ideaFeatures.ideaId })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideaFeatures.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Feature not found");
  }

  await db
    .update(ideaFeatures)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(ideaFeatures.id, id));

  revalidatePath(`/dashboard/ideas/${existing.ideaId}`);
  revalidatePath("/dashboard/ideas");
}

export async function restoreFeature(userId: string, id: string) {
  const db = getDb();

  const [existing] = await db
    .select({ id: ideaFeatures.id, ideaId: ideaFeatures.ideaId })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideaFeatures.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Feature not found");
  }

  const [updated] = await db
    .update(ideaFeatures)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(ideaFeatures.id, id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${existing.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function setFeatureCompletion(userId: string, id: string, completed: boolean) {
  const db = getDb();

  const [existing] = await db
    .select({
      id: ideaFeatures.id,
      ideaId: ideaFeatures.ideaId,
    })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideaFeatures.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Feature not found");
  }

  const [updated] = await db
    .update(ideaFeatures)
    .set({
      completed,
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(ideaFeatures.id, id))
    .returning();

  const feature = normalizeFeature(updated);

  revalidatePath(`/dashboard/ideas/${existing.ideaId}`);
  revalidatePath("/dashboard/ideas");

  return feature;
}

export async function getFeatureById(userId: string, id: string) {
  const db = getDb();

  const [existing] = await db
    .select({
      feature: ideaFeatures,
      ideaId: ideaFeatures.ideaId,
    })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideaFeatures.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Feature not found");
  }

  return {
    feature: normalizeFeature(existing.feature),
    ideaId: existing.ideaId,
  };
}

export async function reorderFeatures(userId: string, ideaId: string, orderedIds: string[]) {
  if (orderedIds.length === 0) return;

  const db = getDb();

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: ideaFeatures.id, superStarred: ideaFeatures.superStarred })
      .from(ideaFeatures)
      .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
      .where(
        and(
          eq(ideaFeatures.ideaId, ideaId),
          eq(ideas.userId, userId),
          isNull(ideas.deletedAt),
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

type StoredFeatureDetail = {
  id: string;
  label: string;
  body: string;
  position: number;
};

export type FeatureDetailRecord = StoredFeatureDetail;

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

export type FeatureRecord = ReturnType<typeof normalizeFeature>;

function normalizeFeature(row: typeof ideaFeatures.$inferSelect) {
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
  };
}
