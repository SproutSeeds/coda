"use server";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, isNull, isNotNull } from "drizzle-orm";
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
    .orderBy(asc(ideaFeatures.completed), desc(ideaFeatures.starred), asc(ideaFeatures.position), desc(ideaFeatures.createdAt));

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

  const [top] = await db
    .select({ position: ideaFeatures.position })
    .from(ideaFeatures)
    .where(eq(ideaFeatures.ideaId, payload.ideaId))
    .orderBy(asc(ideaFeatures.position))
    .limit(1);

  const position = top?.position !== undefined ? top.position - 1000 : Date.now();
  const detailSections = prepareDetailSectionsForStorage(payload.detailSections);
  const primaryDetail = detailSections[0];

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
      starred: payload.starred,
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
  if (payload.starred !== undefined) updates.starred = payload.starred;
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

export async function updateFeatureStar(userId: string, id: string, starred: boolean) {
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
    .set({ starred, updatedAt: new Date() })
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
      .select({ id: ideaFeatures.id })
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
  };
}
