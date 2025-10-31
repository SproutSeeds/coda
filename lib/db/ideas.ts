"use server";

import { and, asc, desc, eq, ilike, isNull, isNotNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { ideas } from "@/lib/db/schema";
import { sanitizeIdeaNotes, validateIdeaInput, validateIdeaReorder, validateIdeaUpdate } from "@/lib/validations/ideas";
import { SuperStarLimitError } from "@/lib/errors/super-star-limit";
import { ensureSuperStarPlacement } from "@/lib/utils/super-star-ordering";

export type IdeaSort = "priority" | "created_desc" | "updated_desc" | "title_asc";

const SUPER_STAR_LIMIT = 3;

function getOrderBy(sort: IdeaSort) {
  switch (sort) {
    case "created_desc":
      return [
        desc(ideas.superStarred),
        desc(ideas.starred),
        desc(ideas.createdAt),
      ];
    case "updated_desc":
      return [
        desc(ideas.superStarred),
        desc(ideas.starred),
        desc(ideas.updatedAt),
      ];
    case "title_asc":
      return [
        desc(ideas.superStarred),
        desc(ideas.starred),
        asc(ideas.title),
      ];
    case "priority":
    default:
      return [
        desc(ideas.superStarred),
        desc(ideas.starred),
        asc(ideas.position),
        desc(ideas.createdAt),
      ];
  }
}

export async function listIdeas(userId: string, limit = 100, cursor?: string, sort: IdeaSort = "priority") {
  const db = getDb();

  const conditions = [eq(ideas.userId, userId), isNull(ideas.deletedAt)];

  if (cursor && sort === "priority") {
    const [anchor] = await db
      .select({ position: ideas.position })
      .from(ideas)
      .where(and(eq(ideas.id, cursor), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
      .limit(1);

    if (anchor && anchor.position !== null) {
      conditions.push(sql`${ideas.position} > ${anchor.position}`);
    }
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]!;

  const rows = await db
    .select()
    .from(ideas)
    .where(whereClause)
    .orderBy(...getOrderBy(sort))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = (hasNextPage ? rows.slice(0, -1) : rows).map(normalizeIdea);
  const nextCursor = sort === "priority" && hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
  };
}

export async function getIdea(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!row) {
    throw new Error("Idea not found");
  }

  return normalizeIdea(row);
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
    .orderBy(
      desc(ideas.superStarred),
      desc(ideas.starred),
      desc(ideas.updatedAt),
    );

  return rows.map(normalizeIdea);
}

export async function createIdea(userId: string, input: { title: string; notes: string; githubUrl?: string | null; linkLabel?: string | null }) {
  const payload = validateIdeaInput(input);
  const db = getDb();
  const [top] = await db
    .select({ position: ideas.position })
    .from(ideas)
    .where(and(eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .orderBy(asc(ideas.position))
    .limit(1);

  const position = top?.position !== undefined ? top.position - 1000 : Date.now();
  const [created] = await db
    .insert(ideas)
    .values({
      userId,
      title: payload.title,
      notes: sanitizeIdeaNotes(payload.notes),
      position,
      starred: false,
      superStarred: false,
      superStarredAt: null,
      githubUrl: payload.githubUrl ?? null,
      linkLabel: payload.linkLabel ?? "GitHub Repository",
    })
    .returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(created);
}

export async function updateIdea(userId: string, id: string, input: { title?: string; notes?: string; githubUrl?: string | null; linkLabel?: string | null; updatedAt: Date }) {
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
  if (payload.notes !== undefined) updates.notes = sanitizeIdeaNotes(payload.notes);
  if (payload.githubUrl !== undefined) updates.githubUrl = payload.githubUrl;
  if (payload.linkLabel !== undefined) updates.linkLabel = payload.linkLabel ?? "GitHub Repository";

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

export async function reorderIdeas(userId: string, orderedIds: string[]) {
  const ids = validateIdeaReorder(orderedIds);
  if (ids.length === 0) {
    return;
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: ideas.id, superStarred: ideas.superStarred })
      .from(ideas)
      .where(and(eq(ideas.userId, userId), isNull(ideas.deletedAt)));

    const existingIds = new Set(existing.map((row) => row.id));
    if (existingIds.size !== ids.length) {
      throw new Error("Reorder payload must include all active ideas.");
    }
    for (const id of ids) {
      if (!existingIds.has(id)) {
        throw new Error("Cannot reorder ideas you do not own.");
      }
    }

    const superStarIds = existing.filter((row) => row.superStarred).map((row) => row.id);
    ensureSuperStarPlacement(ids, superStarIds);

    const updates = ids.map((id, index) => ({ id, position: (index + 1) * 1000 }));
    await Promise.all(
      updates.map(({ id, position }) =>
        tx.update(ideas).set({ position }).where(eq(ideas.id, id)),
      ),
    );
  });

  void revalidatePath("/dashboard/ideas");
}

export async function listDeletedIdeas(userId: string, limit = 50) {
  const db = getDb();
  const rows = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), isNotNull(ideas.deletedAt)))
    .orderBy(desc(ideas.deletedAt))
    .limit(limit);

  return rows.map(normalizeIdea);
}

export type IdeaRecord = ReturnType<typeof normalizeIdea>;

function normalizeIdea(row: typeof ideas.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    undoExpiresAt: row.undoExpiresAt ? row.undoExpiresAt.toISOString() : null,
    position: Number(row.position),
    starred: Boolean(row.starred),
    superStarred: Boolean(row.superStarred),
    superStarredAt: row.superStarredAt ? row.superStarredAt.toISOString() : null,
    githubUrl: row.githubUrl ?? null,
    linkLabel: row.linkLabel ?? "GitHub Repository",
  };
}


export async function purgeIdea(userId: string, id: string) {
    const db = getDb();
  const result = await db
    .delete(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .returning();
  if (result.length === 0) {
    throw new Error("Idea not found");
  }
  return result[0];
}

export type IdeaStarState = "none" | "star" | "super";

function getCurrentStarState(row: typeof ideas.$inferSelect): IdeaStarState {
  if (row.superStarred) {
    return "super";
  }
  if (row.starred) {
    return "star";
  }
  return "none";
}

function resolveFlagsForStarState(state: IdeaStarState) {
  const starred = state !== "none";
  const superStarred = state === "super";
  return {
    starred,
    superStarred,
    superStarredAt: superStarred ? new Date() : null,
  } satisfies Partial<typeof ideas.$inferInsert>;
}

export async function setIdeaStarState(userId: string, id: string, state: IdeaStarState) {
  const db = getDb();

  const idea = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(ideas)
      .where(and(eq(ideas.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new Error("Idea not found");
    }

    const currentState = getCurrentStarState(existing);
    if (currentState === state) {
      return existing;
    }

    if (state === "super" && currentState !== "super") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(ideas)
        .where(
          and(
            eq(ideas.userId, userId),
            isNull(ideas.deletedAt),
            eq(ideas.superStarred, true),
            ne(ideas.id, id),
          ),
        );

      if (Number(count) >= SUPER_STAR_LIMIT) {
        throw new SuperStarLimitError();
      }
    }

    const updates = {
      ...resolveFlagsForStarState(state),
      updatedAt: new Date(),
    } satisfies Partial<typeof ideas.$inferInsert>;

    const [updated] = await tx
      .update(ideas)
      .set(updates)
      .where(eq(ideas.id, id))
      .returning();

    return updated;
  });

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(idea);
}

export async function cycleIdeaStarState(userId: string, id: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Idea not found");
  }

  const nextState: IdeaStarState = (() => {
    const current = getCurrentStarState(existing);
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

  return setIdeaStarState(userId, id, nextState);
}
