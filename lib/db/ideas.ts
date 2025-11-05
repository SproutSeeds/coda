import "server-only";

import { and, asc, desc, eq, ilike, isNull, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { logUsageCost } from "@/lib/usage/log-cost";
import { enforceLimit } from "@/lib/limits/guard";
import { ideaCollaborators, ideas, users } from "@/lib/db/schema";
import { sanitizeIdeaNotes, validateIdeaInput, validateIdeaReorder, validateIdeaUpdate } from "@/lib/validations/ideas";
import { SuperStarLimitError } from "@/lib/errors/super-star-limit";
import { ensureSuperStarPlacement } from "@/lib/utils/super-star-ordering";
import { getIdeaAccess, requireIdeaAccess, type CollaboratorRole } from "@/lib/db/access";

export type IdeaSort = "priority" | "created_desc" | "updated_desc" | "title_asc";

const SUPER_STAR_LIMIT = 3;
const DEFAULT_IDEA_VISIBILITY: typeof ideas.$inferInsert["visibility"] = "private";

type NormalizedIdeaMeta = {
  accessRole: CollaboratorRole;
  isOwner: boolean;
};

function getOrderBy(sort: IdeaSort) {
  switch (sort) {
    case "created_desc":
      return [desc(ideas.superStarred), desc(ideas.starred), desc(ideas.createdAt)];
    case "updated_desc":
      return [desc(ideas.superStarred), desc(ideas.starred), desc(ideas.updatedAt)];
    case "title_asc":
      return [desc(ideas.superStarred), desc(ideas.starred), asc(ideas.title)];
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

function normalizeIdea(row: typeof ideas.$inferSelect, meta: NormalizedIdeaMeta) {
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
    visibility: row.visibility,
    accessRole: meta.accessRole,
    isOwner: meta.isOwner,
  };
}

export type IdeaRecord = ReturnType<typeof normalizeIdea>;

export type PublicIdeaSummary = {
  idea: IdeaRecord;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export async function listIdeas(userId: string, limit = 100, cursor?: string, sort: IdeaSort = "priority") {
  const db = getDb();
  const membership = alias(ideaCollaborators, "membership_list");

  const conditions = [isNull(ideas.deletedAt), or(eq(ideas.userId, userId), isNotNull(membership.id))];

  if (cursor && sort === "priority") {
    const anchor = await getIdeaAccess(userId, cursor, { db, allowPublic: false });
    if (anchor && anchor.idea.position !== null) {
      conditions.push(sql`${ideas.position} > ${anchor.idea.position}`);
    }
  }

  const rows = await db
    .select({
      idea: ideas,
      role: membership.role,
    })
    .from(ideas)
    .leftJoin(
      membership,
      and(eq(membership.ideaId, ideas.id), eq(membership.userId, userId)),
    )
    .where(and(...conditions))
    .orderBy(...getOrderBy(sort))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const slice = hasNextPage ? rows.slice(0, -1) : rows;
  const items = slice.map((row) =>
    normalizeIdea(row.idea, {
      accessRole: row.role ?? (row.idea.userId === userId ? "owner" : "viewer"),
      isOwner: row.idea.userId === userId,
    }),
  );

  const nextCursor = sort === "priority" && hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
  };
}

export async function listPublicIdeas(viewerId: string | null, limit = 24, cursor?: string) {
  const db = getDb();
  const membership = alias(ideaCollaborators, "membership_public");
  const owner = alias(users, "owner_public");
  const membershipViewerId = viewerId ?? "__public__";

  let cursorDate: Date | null = null;
  if (cursor) {
    const parsed = new Date(cursor);
    if (!Number.isNaN(parsed.getTime())) {
      cursorDate = parsed;
    }
  }

  const baseCondition = and(isNull(ideas.deletedAt), eq(ideas.visibility, "public"));
  const whereCondition = cursorDate ? and(baseCondition, lt(ideas.updatedAt, cursorDate)) : baseCondition;

  const rows = await db
    .select({
      idea: ideas,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerEmail: owner.email,
      membershipRole: membership.role,
    })
    .from(ideas)
    .innerJoin(owner, eq(owner.id, ideas.userId))
    .leftJoin(
      membership,
      and(eq(membership.ideaId, ideas.id), eq(membership.userId, membershipViewerId)),
    )
    .where(whereCondition)
    .orderBy(desc(ideas.updatedAt), desc(ideas.createdAt))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const slice = hasNextPage ? rows.slice(0, -1) : rows;

  const items = slice.map((row) => {
    const isOwner = row.idea.userId === viewerId;
    const accessRole = isOwner
      ? "owner"
      : row.membershipRole ?? (viewerId ? "viewer" : "viewer");

    return {
      idea: normalizeIdea(row.idea, { accessRole, isOwner }),
      owner: {
        id: row.ownerId,
        name: row.ownerName,
        email: row.ownerEmail,
      },
    } satisfies PublicIdeaSummary;
  });

  const last = slice[slice.length - 1];
  const nextCursor = hasNextPage && last?.idea.updatedAt ? last.idea.updatedAt.toISOString() : null;

  return {
    items,
    nextCursor,
  };
}

export async function getIdea(userId: string, id: string) {
  const access = await requireIdeaAccess(userId, id, "read", { allowPublic: true });
  return normalizeIdea(access.idea, { accessRole: access.accessRole, isOwner: access.isOwner });
}

export async function searchIdeas(userId: string, query: string) {
  const db = getDb();
  const membership = alias(ideaCollaborators, "membership_search");
  const normalized = query.trim().toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const wantsPublic = tokens.includes("public");
  const wantsPrivate = tokens.includes("private");
  const q = `%${query}%`;

  const baseConditions = [
    isNull(ideas.deletedAt),
    or(eq(ideas.userId, userId), isNotNull(membership.id)),
  ] as const;

  const searchPredicates = [
    ilike(ideas.title, q),
    ilike(ideas.notes, q),
  ] as const;

  const visibilityPredicates = [
    ...(wantsPublic ? [eq(ideas.visibility, "public" as const)] : []),
    ...(wantsPrivate ? [eq(ideas.visibility, "private" as const)] : []),
  ];

  const rows = await db
    .select({
      idea: ideas,
      role: membership.role,
    })
    .from(ideas)
    .leftJoin(
      membership,
      and(eq(membership.ideaId, ideas.id), eq(membership.userId, userId)),
    )
    .where(
      and(
        ...baseConditions,
        or(...searchPredicates, ...visibilityPredicates),
      ),
    )
    .orderBy(desc(ideas.superStarred), desc(ideas.starred), desc(ideas.updatedAt));

  return rows.map((row) =>
    normalizeIdea(row.idea, {
      accessRole: row.role ?? (row.idea.userId === userId ? "owner" : "viewer"),
      isOwner: row.idea.userId === userId,
    }),
  );
}

export async function createIdea(
  userId: string,
  input: { title: string; notes: string; githubUrl?: string | null; linkLabel?: string | null; visibility?: "private" | "public" },
) {
  const payload = validateIdeaInput(input);
  const db = getDb();

  const limit = await enforceLimit({
    scope: { type: "user", id: userId },
    metric: "ideas.per_user.lifetime",
    userId,
    credit: { amount: 1 },
    message: "You’ve reached the maximum number of ideas allowed on your current plan.",
  });

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
      visibility: payload.visibility ?? DEFAULT_IDEA_VISIBILITY,
    })
    .returning();

  await db
    .insert(ideaCollaborators)
    .values({ ideaId: created.id, userId, role: "owner", invitedBy: userId })
    .onConflictDoNothing({ target: [ideaCollaborators.ideaId, ideaCollaborators.userId] });

  await logUsageCost({
    payer: limit.payer,
    action: "idea.create",
    creditsDebited: limit.credit?.amount ?? 0,
    metadata: {
      ideaId: created.id,
      chargedPayer: limit.credit?.chargedPayer ?? null,
    },
  });

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(created, { accessRole: "owner", isOwner: true });
}

export async function updateIdea(
  userId: string,
  id: string,
  input: { title?: string; notes?: string; githubUrl?: string | null; linkLabel?: string | null; visibility?: "private" | "public"; updatedAt: Date },
) {
  const payload = validateIdeaUpdate({ id, ...input });
  const db = getDb();
  const access = await requireIdeaAccess(userId, id, "write", { db });

  const currentUpdatedAt = access.idea.updatedAt?.toISOString?.() ?? String(access.idea.updatedAt);
  if (input.updatedAt && new Date(input.updatedAt).toISOString() !== currentUpdatedAt) {
    throw new Error("Idea has been modified. Refresh before editing again.");
  }

  const updates: Partial<typeof ideas.$inferInsert> = { updatedAt: new Date() };
  if (payload.title) updates.title = payload.title;
  if (payload.notes !== undefined) updates.notes = sanitizeIdeaNotes(payload.notes);
  if (payload.githubUrl !== undefined) updates.githubUrl = payload.githubUrl;
  if (payload.linkLabel !== undefined) updates.linkLabel = payload.linkLabel ?? "GitHub Repository";
  if (payload.visibility !== undefined) updates.visibility = payload.visibility;

  const [updated] = await db.update(ideas).set(updates).where(eq(ideas.id, id)).returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(updated, { accessRole: access.accessRole, isOwner: access.isOwner });
}

export async function softDeleteIdea(userId: string, id: string, undoToken: string, undoExpiresAt: Date) {
  const db = getDb();
  const access = await requireIdeaAccess(userId, id, "owner", { db, includeDeleted: true });

  const [updated] = await db
    .update(ideas)
    .set({ deletedAt: new Date(), undoToken, undoExpiresAt })
    .where(eq(ideas.id, id))
    .returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(updated, { accessRole: access.accessRole, isOwner: access.isOwner });
}

export async function restoreIdea(userId: string, id: string) {
  const db = getDb();
  const access = await requireIdeaAccess(userId, id, "owner", { db, includeDeleted: true });

  const [updated] = await db
    .update(ideas)
    .set({ deletedAt: null, undoToken: null, undoExpiresAt: null, updatedAt: new Date() })
    .where(eq(ideas.id, id))
    .returning();

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(updated, { accessRole: access.accessRole, isOwner: access.isOwner });
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
    await Promise.all(updates.map(({ id, position }) => tx.update(ideas).set({ position }).where(eq(ideas.id, id))));
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

  return rows.map((row) => normalizeIdea(row, { accessRole: "owner", isOwner: true }));
}

export async function purgeIdea(userId: string, id: string) {
  const db = getDb();
  await requireIdeaAccess(userId, id, "owner", { db, includeDeleted: true });

  const [removed] = await db.delete(ideas).where(eq(ideas.id, id)).returning();
  if (!removed) {
    throw new Error("Idea not found");
  }
  return removed;
}

export type IdeaStarState = "none" | "star" | "super";

function getCurrentStarState(row: Pick<typeof ideas.$inferSelect, "starred" | "superStarred">): IdeaStarState {
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
  const access = await requireIdeaAccess(userId, id, "write", { db });

  const idea = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(ideas)
      .where(and(eq(ideas.id, id), isNull(ideas.deletedAt)))
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
            eq(ideas.userId, existing.userId),
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

    const [updated] = await tx.update(ideas).set(updates).where(eq(ideas.id, id)).returning();
    return updated;
  });

  revalidatePath("/dashboard/ideas");
  return normalizeIdea(idea, { accessRole: access.accessRole, isOwner: access.isOwner });
}

export async function cycleIdeaStarState(userId: string, id: string) {
  const access = await requireIdeaAccess(userId, id, "write");

  const nextState: IdeaStarState = (() => {
    const current = getCurrentStarState(access.idea);
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
