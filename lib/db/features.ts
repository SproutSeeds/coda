"use server";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { ideaFeatures, ideas } from "@/lib/db/schema";
import { validateFeatureInput, validateFeatureUpdate, type FeatureInput, type FeatureUpdateInput } from "@/lib/validations/features";

export async function listFeatures(userId: string, ideaId: string) {
  const db = getDb();

  const rows = await db
    .select({ feature: ideaFeatures })
    .from(ideaFeatures)
    .innerJoin(ideas, eq(ideas.id, ideaFeatures.ideaId))
    .where(and(eq(ideas.userId, userId), eq(ideaFeatures.ideaId, ideaId), isNull(ideas.deletedAt)))
    .orderBy(asc(ideaFeatures.completed), desc(ideaFeatures.starred), asc(ideaFeatures.position), desc(ideaFeatures.createdAt));

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

  const [created] = await db
    .insert(ideaFeatures)
    .values({
      ideaId: payload.ideaId,
      title: payload.title,
      notes: payload.notes,
      position,
      starred: payload.starred ?? false,
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

  await db.delete(ideaFeatures).where(eq(ideaFeatures.id, id));

  revalidatePath(`/dashboard/ideas/${existing.ideaId}`);
  revalidatePath("/dashboard/ideas");
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

export type FeatureRecord = ReturnType<typeof normalizeFeature>;

function normalizeFeature(row: typeof ideaFeatures.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
    completed: Boolean(row.completed),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
