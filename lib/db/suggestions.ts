"use server";

import { and, asc, desc, eq, ilike, isNull, isNotNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { suggestionUpdates, suggestions, users } from "@/lib/db/schema";
import { findOrCreateUserByEmail } from "@/lib/auth/users";
import { sanitizeIdeaNotes, validateIdeaInput, validateIdeaReorder, validateIdeaUpdate } from "@/lib/validations/ideas";

export type SuggestionSort = "priority" | "created_desc" | "updated_desc" | "title_asc";

const SCHEMA_NOT_READY_CODES = new Set(["42P01", "42703", "42883"]);
const SCHEMA_NOT_READY_SNIPPETS = [
  "relation \"suggestions\"",
  "relation \"suggestion_updates\"",
  "column \"owner_id\" does not exist",
  "column \"completed\" does not exist",
  "column \"completed_at\" does not exist",
  "column \"deleted_at\" does not exist",
];

function isSchemaNotReady(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code && SCHEMA_NOT_READY_CODES.has(code)) {
    return true;
  }
  if (typeof message === "string") {
    const lower = message.toLowerCase();
    if (SCHEMA_NOT_READY_SNIPPETS.some((snippet) => lower.includes(snippet))) {
      return true;
    }
    if (lower.includes("does not exist") && lower.includes("suggestion")) {
      return true;
    }
  }
  return false;
}

function handleSchemaNotReady<T>(error: unknown, fallback: T, context: string): T {
  if (isSchemaNotReady(error)) {
    console.warn(`[suggestions] ${context}; schema unavailable.`, error);
    return fallback;
  }
  throw error;
}

function ensureSchemaReady(error: unknown, context: string): never {
  if (isSchemaNotReady(error)) {
    throw new Error(`${context}. Please run the latest database migrations.`);
  }
  throw error;
}

function getOrderBy(sort: SuggestionSort) {
  switch (sort) {
    case "created_desc":
      return [desc(suggestions.starred), desc(suggestions.createdAt)];
    case "updated_desc":
      return [desc(suggestions.starred), desc(suggestions.updatedAt)];
    case "title_asc":
      return [desc(suggestions.starred), asc(suggestions.title)];
    case "priority":
    default:
      return [desc(suggestions.starred), asc(suggestions.position), desc(suggestions.createdAt)];
  }
}

export type SuggestionRecord = ReturnType<typeof normalizeSuggestion>;
export type SuggestionUpdateRecord = ReturnType<typeof normalizeSuggestionUpdate>;
type SuggestionListResult = { items: SuggestionRecord[]; nextCursor: string | null };

function normalizeSuggestion(row: typeof suggestions.$inferSelect) {
  return {
    id: row.id,
    ownerId: row.ownerId,
    submittedBy: row.submittedBy ?? null,
    submittedEmail: row.submittedEmail ?? null,
    title: row.title,
    notes: row.notes,
    position: Number(row.position),
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
    starred: Boolean(row.starred),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    undoToken: row.undoToken ?? null,
    undoExpiresAt: row.undoExpiresAt ? row.undoExpiresAt.toISOString() : null,
    completed: Boolean(row.completed),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  } as const;
}

function normalizeSuggestionUpdate(row: typeof suggestionUpdates.$inferSelect) {
  return {
    id: row.id,
    suggestionId: row.suggestionId,
    authorId: row.authorId ?? null,
    authorEmail: row.authorEmail ?? null,
    body: row.body,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
  } as const;
}

export async function resolveDeveloperId(email: string) {
  const normalized = email.toLowerCase();
  const db = getDb();
  const [record] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);

  const developerId = record?.id ?? (await findOrCreateUserByEmail(normalized)).id;

  try {
    await db
      .update(suggestions)
      .set({ ownerId: developerId })
      .where(ne(suggestions.ownerId, developerId));
  } catch (error) {
    if (!isSchemaNotReady(error)) {
      throw error;
    }
  }

  return developerId;
}

export async function listSuggestions(ownerId: string, limit = 100, cursor?: string, sort: SuggestionSort = "priority") {
  const db = getDb();
  const conditions = [eq(suggestions.ownerId, ownerId), isNull(suggestions.deletedAt)];

  if (cursor && sort === "priority") {
    const [anchor] = await db
      .select({ position: suggestions.position })
      .from(suggestions)
      .where(and(eq(suggestions.id, cursor), eq(suggestions.ownerId, ownerId), isNull(suggestions.deletedAt)))
      .limit(1);

    if (anchor && anchor.position !== null) {
      conditions.push(sql`${suggestions.position} > ${anchor.position}`);
    }
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]!;

  try {
    const rows = await db
      .select()
      .from(suggestions)
      .where(whereClause)
      .orderBy(...getOrderBy(sort))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = (hasNextPage ? rows.slice(0, -1) : rows).map(normalizeSuggestion);
    const nextCursor = sort === "priority" && hasNextPage ? items[items.length - 1]?.id ?? null : null;

    return {
      items,
      nextCursor,
    };
  } catch (error) {
    return handleSchemaNotReady<SuggestionListResult>(error, { items: [], nextCursor: null }, "Failed to list suggestions");
  }
}


export async function getSuggestion(ownerId: string, id: string) {
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.id, id), eq(suggestions.ownerId, ownerId), isNull(suggestions.deletedAt)))
      .limit(1);
    if (!row) {
      throw new Error("Suggestion not found");
    }
    return normalizeSuggestion(row);
  } catch (error) {
    ensureSchemaReady(error, "Suggestion lookup failed");
  }
}

export async function getSuggestionForSubmitter(submitterId: string, submitterEmail: string | null, id: string) {
  const db = getDb();
  const emailCondition = submitterEmail ? eq(suggestions.submittedEmail, submitterEmail.toLowerCase()) : null;
  const baseCondition = eq(suggestions.submittedBy, submitterId);
  const accessCondition = emailCondition ? or(baseCondition, emailCondition) : baseCondition;
  try {
    const [row] = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.id, id), accessCondition, isNull(suggestions.deletedAt)))
      .limit(1);
    if (!row) {
      throw new Error("Suggestion not found");
    }
    return normalizeSuggestion(row);
  } catch (error) {
    ensureSchemaReady(error, "Suggestion lookup for submitter failed");
  }
}

export async function listSuggestionsForSubmitter(submitterId: string, submitterEmail?: string | null, limit = 50) {
  const db = getDb();
  const emailCondition = submitterEmail ? eq(suggestions.submittedEmail, submitterEmail.toLowerCase()) : null;
  const baseCondition = eq(suggestions.submittedBy, submitterId);
  const accessCondition = emailCondition ? or(baseCondition, emailCondition) : baseCondition;
  try {
    const rows = await db
      .select()
      .from(suggestions)
      .where(and(isNull(suggestions.deletedAt), accessCondition))
      .orderBy(desc(suggestions.createdAt))
      .limit(limit);
    return rows.map(normalizeSuggestion);
  } catch (error) {
    return handleSchemaNotReady<SuggestionRecord[]>(error, [], "Failed to list submitter suggestions");
  }
}
export async function listDeletedSuggestions(ownerId: string, limit = 50) {
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.ownerId, ownerId), isNotNull(suggestions.deletedAt)))
      .orderBy(desc(suggestions.deletedAt))
      .limit(limit);
    return rows.map(normalizeSuggestion);
  } catch (error) {
    return handleSchemaNotReady<SuggestionRecord[]>(error, [], "Failed to list deleted suggestions");
  }
}

export async function searchSuggestions(ownerId: string, query: string) {
  const db = getDb();
  const q = `%${query}%`;
  try {
    const rows = await db
      .select()
      .from(suggestions)
      .where(
        and(
          eq(suggestions.ownerId, ownerId),
          isNull(suggestions.deletedAt),
          or(ilike(suggestions.title, q), ilike(suggestions.notes, q)),
        ),
      )
      .orderBy(desc(suggestions.starred), desc(suggestions.updatedAt));

    return rows.map(normalizeSuggestion);
  } catch (error) {
    return handleSchemaNotReady<SuggestionRecord[]>(error, [], "Failed to search suggestions");
  }
}

export async function createSuggestion(
  ownerId: string,
  submittedBy: string | null,
  submittedEmail: string | null,
  input: { title: string; notes: string },
) {
  const payload = validateIdeaInput(input);
  const db = getDb();

  const [top] = await db
    .select({ position: suggestions.position })
    .from(suggestions)
    .where(and(eq(suggestions.ownerId, ownerId), isNull(suggestions.deletedAt)))
    .orderBy(asc(suggestions.position))
    .limit(1);

  const position = top?.position !== undefined ? top.position - 1000 : Date.now();
  const [created] = await db
    .insert(suggestions)
    .values({
      ownerId,
      submittedBy,
      submittedEmail,
      title: payload.title,
      notes: sanitizeIdeaNotes(payload.notes),
      position,
      starred: false,
    })
    .returning();

  revalidatePath("/dashboard/suggestions");
  return normalizeSuggestion(created);
}

export async function updateSuggestion(ownerId: string, id: string, input: { title?: string; notes?: string; updatedAt: Date }) {
  const db = getDb();
  const [existing] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("Suggestion not found");
  }

  const currentUpdatedAt = existing.updatedAt?.toISOString?.() ?? String(existing.updatedAt);
  if (input.updatedAt && new Date(input.updatedAt).toISOString() !== currentUpdatedAt) {
    throw new Error("Suggestion has been modified. Refresh before editing again.");
  }

  const payload = validateIdeaUpdate({ id, ...input });
  const updates: Partial<typeof suggestions.$inferInsert> = { updatedAt: new Date() };
  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.notes !== undefined) updates.notes = sanitizeIdeaNotes(payload.notes);

  const [updated] = await db.update(suggestions).set(updates).where(eq(suggestions.id, id)).returning();
  revalidatePath("/dashboard/suggestions");
  return normalizeSuggestion(updated);
}

export async function updateSuggestionStar(ownerId: string, id: string, starred: boolean) {
  const db = getDb();
  const [existing] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("Suggestion not found");
  }
  const [updated] = await db
    .update(suggestions)
    .set({ starred, updatedAt: new Date() })
    .where(eq(suggestions.id, id))
    .returning();
  revalidatePath("/dashboard/suggestions");
  return normalizeSuggestion(updated);
}

export async function setSuggestionCompletion(ownerId: string, id: string, completed: boolean) {
  const db = getDb();
  const [existing] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("Suggestion not found");
  }
  const now = new Date();
  const [updated] = await db
    .update(suggestions)
    .set({
      completed,
      completedAt: completed ? now : null,
      updatedAt: now,
    })
    .where(eq(suggestions.id, id))
    .returning();
  revalidatePath("/dashboard/suggestions");
  revalidatePath(`/dashboard/suggestions/${id}`);
  return normalizeSuggestion(updated);
}


export async function listSuggestionUpdates(suggestionId: string) {
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(suggestionUpdates)
      .where(eq(suggestionUpdates.suggestionId, suggestionId))
      .orderBy(asc(suggestionUpdates.createdAt));
    return rows.map(normalizeSuggestionUpdate);
  } catch (error) {
    return handleSchemaNotReady<SuggestionUpdateRecord[]>(error, [], "Failed to load suggestion updates");
  }
}

export async function createSuggestionUpdate(
  suggestionId: string,
  authorId: string | null,
  authorEmail: string | null,
  body: string,
) {
  const db = getDb();
  const [created] = await db
    .insert(suggestionUpdates)
    .values({ suggestionId, authorId, authorEmail, body })
    .returning();
  revalidatePath(`/dashboard/suggestions/${suggestionId}`);
  return normalizeSuggestionUpdate(created);
}
export async function softDeleteSuggestion(ownerId: string, id: string, undoToken: string, undoExpiresAt: Date) {
  const db = getDb();
  const [existing] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("Suggestion not found");
  }
  const [updated] = await db
    .update(suggestions)
    .set({ deletedAt: new Date(), undoToken, undoExpiresAt })
    .where(eq(suggestions.id, id))
    .returning();
  revalidatePath("/dashboard/suggestions");
  return normalizeSuggestion(updated);
}

export async function restoreSuggestion(ownerId: string, id: string) {
  const db = getDb();
  const [existing] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("Suggestion not found");
  }
  const [updated] = await db
    .update(suggestions)
    .set({ deletedAt: null, undoToken: null, undoExpiresAt: null, updatedAt: new Date() })
    .where(eq(suggestions.id, id))
    .returning();
  revalidatePath("/dashboard/suggestions");
  return normalizeSuggestion(updated);
}

export async function purgeSuggestion(ownerId: string, id: string) {
  const db = getDb();
  const [existing] = await db.select().from(suggestions).where(eq(suggestions.id, id));
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error("Suggestion not found");
  }
  await db.delete(suggestions).where(eq(suggestions.id, id));
  revalidatePath("/dashboard/suggestions");
}

export async function reorderSuggestions(ownerId: string, orderedIds: string[]) {
  const ids = validateIdeaReorder(orderedIds);
  if (ids.length === 0) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: suggestions.id })
      .from(suggestions)
      .where(and(eq(suggestions.ownerId, ownerId), isNull(suggestions.deletedAt)));

    const existingIds = new Set(existing.map((row) => row.id));
    if (existingIds.size !== ids.length) {
      throw new Error("Reorder payload must include all active suggestions.");
    }

    let position = Date.now();
    for (const id of ids) {
      if (!existingIds.has(id)) {
        throw new Error("Invalid suggestion id in reorder payload");
      }
      await tx
        .update(suggestions)
        .set({ position, updatedAt: new Date() })
        .where(eq(suggestions.id, id));
      position += 1000;
    }
  });
  revalidatePath("/dashboard/suggestions");
}
