"use server";

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { ideas } from "@/lib/db/schema";
import { sanitizeIdeaNotes, validateIdeaInput, validateIdeaUpdate } from "@/lib/validations/ideas";

export async function listIdeas(userId: string, limit = 20, cursor?: string) {
  const db = getDb();

  const conditions = [eq(ideas.userId, userId), isNull(ideas.deletedAt)];

  if (cursor) {
    const [anchor] = await db
      .select({ createdAt: ideas.createdAt })
      .from(ideas)
      .where(eq(ideas.id, cursor))
      .limit(1);

    if (anchor) {
      conditions.push(sql`${ideas.createdAt} < ${anchor.createdAt}`);
    }
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]!;

  const rows = await db
    .select()
    .from(ideas)
    .where(whereClause)
    .orderBy(desc(ideas.createdAt))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = (hasNextPage ? rows.slice(0, -1) : rows).map(normalizeIdea);
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
  };
}

export async function searchIdeas(userId: string, query: string) {
  const db = getDb();
  const q = `%${query}%`;
  const rows = await db
    .select()
    .from(ideas)
    .where(
      and(
        eq(ideas.userId, userId),
        isNull(ideas.deletedAt),
        or(ilike(ideas.title, q), ilike(ideas.notes, q)),
      ),
    )
    .orderBy(desc(ideas.createdAt));

  return rows.map(normalizeIdea);
}

export async function createIdea(userId: string, input: { title: string; notes: string }) {
  const payload = validateIdeaInput(input);
  const db = getDb();
  const [created] = await db
    .insert(ideas)
    .values({
      userId,
      title: payload.title,
      notes: sanitizeIdeaNotes(payload.notes),
    })
    .returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(created);
}

export async function updateIdea(userId: string, id: string, input: { title?: string; notes?: string; updatedAt: Date }) {
  const payload = validateIdeaUpdate({ id, ...input });
  const db = getDb();

  const [existing] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!existing || existing.userId !== userId) {
    throw new Error("Idea not found");
  }

  const currentUpdatedAt = existing.updatedAt?.toISOString?.() ?? String(existing.updatedAt);
  if (input.updatedAt && new Date(input.updatedAt).toISOString() !== currentUpdatedAt) {
    throw new Error("Idea has been modified. Refresh before editing again.");
  }

  const updates: Partial<typeof ideas.$inferInsert> = { updatedAt: new Date() };
  if (payload.title) updates.title = payload.title;
  if (payload.notes) updates.notes = sanitizeIdeaNotes(payload.notes);

  const [updated] = await db.update(ideas).set(updates).where(eq(ideas.id, id)).returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(updated);
}

export async function softDeleteIdea(userId: string, id: string, undoToken: string, undoExpiresAt: Date) {
  const db = getDb();
  const [existing] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!existing || existing.userId !== userId) {
    throw new Error("Idea not found");
  }

  const [updated] = await db
    .update(ideas)
    .set({ deletedAt: new Date(), undoToken, undoExpiresAt })
    .where(eq(ideas.id, id))
    .returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(updated);
}

export async function restoreIdea(userId: string, id: string) {
  const db = getDb();
  const [existing] = await db.select().from(ideas).where(eq(ideas.id, id));
  if (!existing || existing.userId !== userId) {
    throw new Error("Idea not found");
  }

  const [updated] = await db
    .update(ideas)
    .set({ deletedAt: null, undoToken: null, undoExpiresAt: null, updatedAt: new Date() })
    .where(eq(ideas.id, id))
    .returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(updated);
}

export type IdeaRecord = ReturnType<typeof normalizeIdea>;

function normalizeIdea(row: typeof ideas.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    undoExpiresAt: row.undoExpiresAt ? row.undoExpiresAt.toISOString() : null,
  };
}
