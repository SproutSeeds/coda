import "server-only";

import { and, eq, ilike, or, sql, not, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideaCollaboratorInvites, ideaCollaborators, users } from "@/lib/db/schema";
import type { ideaCollaborators as ideaCollaboratorsTable } from "@/lib/db/schema";

type DatabaseClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DatabaseClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
type DbLike = DatabaseClient | TransactionClient;

export type AccountStatus = "existing" | "pending_invite" | "invitable";

export type UserDirectoryMatch = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  status: AccountStatus;
};

type CollaboratorRole = typeof ideaCollaboratorsTable.$inferSelect["role"];

export type CollaboratorEmailStatus =
  | {
      status: "existing";
      collaboratorId: string;
      role: CollaboratorRole;
      user: { id: string; email: string; name: string | null; avatar: string | null };
    }
  | {
      status: "pending_invite";
      invite: { id: string; role: CollaboratorRole; expiresAt: string };
      user: { id: string; email: string; name: string | null; avatar: string | null } | null;
    }
  | {
    status: "existing_account";
    user: { id: string; email: string; name: string | null; avatar: string | null };
  }
  | { status: "no_account"; email: string };

export async function lookupUserByEmail(db: DbLike, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(eq(sql`lower(${users.email})`, normalized))
    .limit(1);

  return row ?? null;
}

type DirectoryFilters = {
  ideaId: string;
  search: string;
  limit?: number;
  skipUserIds?: string[];
};

export async function searchAccountDirectory({ ideaId, search, limit = 10, skipUserIds = [] }: DirectoryFilters): Promise<UserDirectoryMatch[]> {
  const db = getDb();
  const normalized = search.trim();
  if (!normalized) {
    return [];
  }

  const pattern = `${normalized.replace(/[%_]/g, "\\$&")}%`;

  const baseCondition = or(ilike(users.email, pattern), ilike(users.name, pattern));
  const whereClause =
    skipUserIds.length > 0 ? and(baseCondition, not(inArray(users.id, skipUserIds))) : baseCondition;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      collaboratorId: ideaCollaborators.id,
      inviteId: ideaCollaboratorInvites.id,
    })
    .from(users)
    .leftJoin(
      ideaCollaborators,
      and(eq(ideaCollaborators.userId, users.id), eq(ideaCollaborators.ideaId, ideaId)),
    )
    .leftJoin(
      ideaCollaboratorInvites,
      and(
        eq(ideaCollaboratorInvites.ideaId, ideaId),
        eq(sql`lower(${ideaCollaboratorInvites.email})`, sql`lower(${users.email})`),
        isNull(ideaCollaboratorInvites.acceptedAt),
      ),
    )
    .where(whereClause)
    .orderBy(users.email)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.image,
    status: row.collaboratorId ? "existing" : row.inviteId ? "pending_invite" : "invitable",
  }));
}

export async function listExistingCollaboratorIds(ideaId: string) {
  const db = getDb();
  const rows = await db
    .select({ userId: ideaCollaborators.userId })
    .from(ideaCollaborators)
    .where(eq(ideaCollaborators.ideaId, ideaId));
  return rows.map((row) => row.userId);
}

export async function resolveCollaboratorEmailStatus(ideaId: string, email: string): Promise<CollaboratorEmailStatus> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Email is required");
  }

  const account = await lookupUserByEmail(db, normalized);

  if (account) {
    const [existingCollaborator] = await db
      .select({ id: ideaCollaborators.id, role: ideaCollaborators.role })
      .from(ideaCollaborators)
      .where(and(eq(ideaCollaborators.ideaId, ideaId), eq(ideaCollaborators.userId, account.id)))
      .limit(1);

    if (existingCollaborator) {
      return {
        status: "existing",
        collaboratorId: existingCollaborator.id,
        role: existingCollaborator.role,
        user: {
          id: account.id,
          email: account.email,
          name: account.name,
          avatar: account.image,
        },
      };
    }
  }

  const [pendingInvite] = await db
    .select({
      id: ideaCollaboratorInvites.id,
      role: ideaCollaboratorInvites.role,
      expiresAt: ideaCollaboratorInvites.expiresAt,
    })
    .from(ideaCollaboratorInvites)
    .where(
      and(
        eq(ideaCollaboratorInvites.ideaId, ideaId),
        eq(sql`lower(${ideaCollaboratorInvites.email})`, normalized),
        isNull(ideaCollaboratorInvites.acceptedAt),
      ),
    )
    .limit(1);

  if (pendingInvite) {
    return {
      status: "pending_invite",
      invite: {
        id: pendingInvite.id,
        role: pendingInvite.role,
        expiresAt: pendingInvite.expiresAt.toISOString(),
      },
      user: account
        ? {
            id: account.id,
            email: account.email,
            name: account.name,
            avatar: account.image,
          }
        : null,
    };
  }

  if (account) {
    return {
      status: "existing_account",
      user: {
        id: account.id,
        email: account.email,
        name: account.name,
        avatar: account.image,
      },
    };
  }

  return { status: "no_account", email: normalized };
}
