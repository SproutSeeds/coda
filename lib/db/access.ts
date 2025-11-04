import "server-only";

import { and, eq, isNull, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db";
import { ideaCollaborators, ideas } from "@/lib/db/schema";

export type CollaboratorRole = typeof ideaCollaborators.$inferSelect["role"];
export type IdeaAccessScope = "read" | "comment" | "write" | "owner" | CollaboratorRole[];

type DatabaseClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DatabaseClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
type DbClient = DatabaseClient | TransactionClient;

const ROLE_SCOPES: Record<Exclude<IdeaAccessScope, CollaboratorRole[]>, CollaboratorRole[]> = {
  read: ["owner", "editor", "commenter", "viewer"],
  comment: ["owner", "editor", "commenter"],
  write: ["owner", "editor"],
  owner: ["owner"],
};

export type IdeaAccessRecord = {
  idea: typeof ideas.$inferSelect;
  accessRole: CollaboratorRole;
  isOwner: boolean;
};

function resolveScope(scope: IdeaAccessScope): CollaboratorRole[] {
  if (Array.isArray(scope)) {
    return scope;
  }
  return ROLE_SCOPES[scope];
}

type AccessOptions = {
  includeDeleted?: boolean;
  allowPublic?: boolean;
  db?: DbClient;
};

export async function getIdeaAccess(
  userId: string,
  ideaId: string,
  options: AccessOptions = {},
): Promise<IdeaAccessRecord | null> {
  const { includeDeleted = false, allowPublic = false } = options;
  const client = options.db ?? getDb();
  const membership = alias(ideaCollaborators, "membership_access");

  const baseConditions = [eq(ideas.id, ideaId)] as const;
  const lifecycleConditions = includeDeleted ? [] : [isNull(ideas.deletedAt)];
  const accessCondition = allowPublic
    ? or(eq(ideas.userId, userId), isNotNull(membership.id), eq(ideas.visibility, "public"))
    : or(eq(ideas.userId, userId), isNotNull(membership.id));

  const [record] = await client
    .select({
      idea: ideas,
      membershipId: membership.id,
      membershipRole: membership.role,
    })
    .from(ideas)
    .leftJoin(
      membership,
      and(eq(membership.ideaId, ideas.id), eq(membership.userId, userId)),
    )
    .where(and(...baseConditions, ...lifecycleConditions, accessCondition))
    .limit(1);

  if (!record) {
    return null;
  }

  const isOwner = record.idea.userId === userId;
  const membershipRole = record.membershipRole;

  let accessRole: CollaboratorRole | null = null;
  if (isOwner) {
    accessRole = "owner";
  } else if (membershipRole) {
    accessRole = membershipRole;
  } else if (allowPublic && record.idea.visibility === "public") {
    accessRole = "viewer";
  }

  if (!accessRole) {
    return null;
  }

  return {
    idea: record.idea,
    accessRole,
    isOwner,
  } satisfies IdeaAccessRecord;
}

export async function requireIdeaAccess(
  userId: string,
  ideaId: string,
  scope: IdeaAccessScope,
  options: AccessOptions = {},
): Promise<IdeaAccessRecord> {
  const access = await getIdeaAccess(userId, ideaId, options);
  if (!access) {
    throw new Error("Idea not found");
  }

  const allowed = resolveScope(scope);
  if (!allowed.includes(access.accessRole)) {
    throw new Error("Insufficient permissions");
  }

  return access;
}
