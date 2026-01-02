import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { requireIdeaAccess } from "@/lib/db/access";
import { ideaCollaborators, ideaJoinRequests, ideaJoinRequestStatusEnum, users } from "@/lib/db/schema";

type IdeaJoinRequestStatus = (typeof ideaJoinRequestStatusEnum.enumValues)[number];

export type IdeaJoinRequestRecord = ReturnType<typeof normalizeJoinRequest>;

export type IdeaJoinRequestActivityEntry = {
  id: string;
  type: "created" | "status_changed" | "owner_seen" | "owner_archived" | "owner_reaction";
  at: string;
  actorId: string | null;
  payload?: Record<string, unknown> | null;
};

type JoinRequestApplicant = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type CollaboratorRoleKey = typeof ideaCollaborators.$inferSelect["role"];

function normalizeActivityEntry(entry: IdeaJoinRequestActivityEntry): IdeaJoinRequestActivityEntry {
  return {
    ...entry,
    at: new Date(entry.at).toISOString(),
    payload: entry.payload ?? null,
  };
}

function buildActivityEntry(
  type: IdeaJoinRequestActivityEntry["type"],
  actorId: string | null,
  payload: Record<string, unknown> | null = null,
  at: Date = new Date(),
): IdeaJoinRequestActivityEntry {
  return {
    id: randomUUID(),
    type,
    at: at.toISOString(),
    actorId,
    payload,
  };
}

function appendActivity(row: typeof ideaJoinRequests.$inferSelect, entry: IdeaJoinRequestActivityEntry) {
  const existing = Array.isArray(row.activityLog) ? row.activityLog : [];
  return [...existing, entry];
}

function normalizeJoinRequest(row: JoinRequestRow, applicant: JoinRequestApplicant | null = null) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    ownerSeenAt: row.ownerSeenAt ? row.ownerSeenAt.toISOString() : null,
    ownerArchivedAt: row.ownerArchivedAt ? row.ownerArchivedAt.toISOString() : null,
    activityLog: Array.isArray(row.activityLog)
      ? row.activityLog.map((entry) => normalizeActivityEntry(entry))
      : [],
    applicant,
  };
}

type DatabaseClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DatabaseClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
type DbLike = DatabaseClient | TransactionClient;
type JoinRequestRow = typeof ideaJoinRequests.$inferSelect;
type JoinRequestRowWithApplicant = {
  row: JoinRequestRow;
  applicant: JoinRequestApplicant | null;
};

async function fetchJoinRequestApplicant(db: DbLike, userId: string): Promise<JoinRequestApplicant | null> {
  const [applicant] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return applicant ?? null;
}

async function fetchJoinRequest(db: DbLike, requestId: string): Promise<JoinRequestRowWithApplicant | null> {
  const [row] = await db
    .select()
    .from(ideaJoinRequests)
    .where(eq(ideaJoinRequests.id, requestId))
    .limit(1);
  if (!row) {
    return null;
  }
  const applicant = await fetchJoinRequestApplicant(db, row.applicantId);
  return { row, applicant };
}

export async function getJoinRequestForApplicant(applicantId: string, ideaId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ideaJoinRequests)
    .where(and(eq(ideaJoinRequests.ideaId, ideaId), eq(ideaJoinRequests.applicantId, applicantId)))
    .orderBy(ideaJoinRequests.createdAt)
    .limit(1);
  return row ? normalizeJoinRequest(row) : null;
}

export async function getPendingJoinRequest(applicantId: string, ideaId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ideaJoinRequests)
    .where(
      and(
        eq(ideaJoinRequests.ideaId, ideaId),
        eq(ideaJoinRequests.applicantId, applicantId),
        eq(ideaJoinRequests.status, "pending"),
      ),
    )
    .limit(1);
  return row ? normalizeJoinRequest(row) : null;
}

export async function createJoinRequest(applicantId: string, ideaId: string, message: string) {
  const db = getDb();
  const existing = await getPendingJoinRequest(applicantId, ideaId);
  if (existing) {
    throw new Error("You already have a pending request for this idea.");
  }
  const activityEntry = buildActivityEntry("created", applicantId, {
    messageLength: message.length,
  });
  const [created] = await db
    .insert(ideaJoinRequests)
    .values({
      ideaId,
      applicantId,
      message,
      status: "pending",
      activityLog: [activityEntry],
    })
    .returning();

  // Credit system disabled - skip usage cost logging
  // await logUsageCost({
  //   payer: actorPays(applicantId),
  //   action: "join-request.create",
  //   metadata: {
  //     ideaId,
  //     requestId: created.id,
  //     messageLength: message.length,
  //   },
  // });

  return normalizeJoinRequest(created);
}

type AssignableCollaboratorRole = Exclude<typeof ideaCollaborators.$inferInsert["role"], "owner">;

export type ResolveJoinRequestInput = {
  status: Extract<IdeaJoinRequestStatus, "approved" | "rejected">;
  note?: string | null;
  grantRole?: AssignableCollaboratorRole;
};

export type ResolveJoinRequestResult = {
  request: IdeaJoinRequestRecord;
  collaboratorId: string | null;
};

export async function resolveJoinRequest(
  resolverId: string,
  requestId: string,
  input: ResolveJoinRequestInput,
): Promise<ResolveJoinRequestResult> {
  const db = getDb();
  const timestamp = new Date();

  return db.transaction(async (tx) => {
    const record = await fetchJoinRequest(tx, requestId);
    if (!record) {
      throw new Error("Join request not found");
    }
    const { row, applicant } = record;

    await requireIdeaAccess(resolverId, row.ideaId, "owner", { db: tx });

    if (row.status !== "pending") {
      throw new Error("This request has already been processed.");
    }

    const activity = appendActivity(
      row,
      buildActivityEntry(
        "status_changed",
        resolverId,
        {
          status: input.status,
          note: input.note ?? null,
          grantRole: input.status === "approved" ? input.grantRole ?? "editor" : null,
        },
        timestamp,
      ),
    );

    const [updated] = await tx
      .update(ideaJoinRequests)
      .set({
        status: input.status,
        processedBy: resolverId,
        processedAt: timestamp,
        resolutionNote: input.note ?? null,
        updatedAt: timestamp,
        ownerSeenAt: row.ownerSeenAt ?? timestamp,
        activityLog: activity,
      })
      .where(eq(ideaJoinRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update join request");
    }

    let collaboratorId: string | null = null;
    if (input.status === "approved") {
      const desiredRole: CollaboratorRoleKey = input.grantRole ?? "editor";
      const rolePriority: Record<CollaboratorRoleKey, number> = {
        viewer: 0,
        commenter: 1,
        editor: 2,
        owner: 3,
      };

      const [existingCollaborator] = await tx
        .select({
          id: ideaCollaborators.id,
          role: ideaCollaborators.role,
        })
        .from(ideaCollaborators)
        .where(and(eq(ideaCollaborators.ideaId, row.ideaId), eq(ideaCollaborators.userId, row.applicantId)))
        .limit(1);

      if (!existingCollaborator) {
        // Credit system disabled - skip limit enforcement
        // const limitResult = await enforceLimit({
        //   scope: { type: "idea", id: row.ideaId },
        //   metric: "collaborators.per_idea.lifetime",
        //   userId: resolverId,
        //   credit: { amount: 1 },
        //   message: "This idea has reached the collaborator limit for your current plan.",
        //   db: tx,
        // });

        const [created] = await tx
          .insert(ideaCollaborators)
          .values({
            ideaId: row.ideaId,
            userId: row.applicantId,
            role: desiredRole,
            invitedBy: resolverId,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning({ id: ideaCollaborators.id });

        collaboratorId = created?.id ?? null;

        // Credit system disabled - skip usage cost logging
        // if (collaboratorId) {
        //   await logUsageCost({
        //     payer: limitResult.payer,
        //     action: "collaborator.add",
        //     creditsDebited: limitResult.credit?.amount ?? 0,
        //     metadata: {
        //       ideaId: row.ideaId,
        //       collaboratorId,
        //       actorId: resolverId,
        //       source: "join-request",
        //       chargedPayer: limitResult.credit?.chargedPayer ?? null,
        //     },
        //   });
        // }
      } else {
        collaboratorId = existingCollaborator.id;
        if (existingCollaborator.role !== "owner") {
          const nextRole =
            rolePriority[desiredRole] >= rolePriority[existingCollaborator.role]
              ? desiredRole
              : existingCollaborator.role;
          if (nextRole !== existingCollaborator.role) {
            await tx
              .update(ideaCollaborators)
              .set({ role: nextRole, updatedAt: timestamp })
              .where(eq(ideaCollaborators.id, existingCollaborator.id));
          }
        }
      }
    }

    return {
      request: normalizeJoinRequest(updated, applicant),
      collaboratorId,
    };
  });
}

export type JoinRequestCounts = {
  pending: number;
  unseen: number;
};

export async function getJoinRequestCounts(ownerId: string, ideaId: string): Promise<JoinRequestCounts> {
  const db = getDb();
  await requireIdeaAccess(ownerId, ideaId, "owner");

  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${ideaJoinRequests.status} = 'pending')`,
      unseen: sql<number>`count(*) filter (where ${ideaJoinRequests.status} = 'pending' AND ${ideaJoinRequests.ownerSeenAt} IS NULL)`,
    })
    .from(ideaJoinRequests)
    .where(eq(ideaJoinRequests.ideaId, ideaId));

  return {
    pending: Number(row?.pending ?? 0),
    unseen: Number(row?.unseen ?? 0),
  };
}

export type ListJoinRequestsOptions = {
  includeProcessed?: boolean;
  includeArchived?: boolean;
  limit?: number;
};

export async function listJoinRequestsForOwner(
  ownerId: string,
  ideaId: string,
  options: ListJoinRequestsOptions = {},
): Promise<IdeaJoinRequestRecord[]> {
  const db = getDb();
  await requireIdeaAccess(ownerId, ideaId, "owner");

  const { includeProcessed = true, includeArchived = false, limit } = options;

  const conditions = [eq(ideaJoinRequests.ideaId, ideaId)] as Array<ReturnType<typeof eq>>;
  if (!includeArchived) {
    conditions.push(isNull(ideaJoinRequests.ownerArchivedAt));
  }
  if (!includeProcessed) {
    conditions.push(eq(ideaJoinRequests.status, "pending"));
  }
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const baseQuery = db
    .select()
    .from(ideaJoinRequests)
    .where(whereClause)
    .orderBy(
      sql`CASE WHEN ${ideaJoinRequests.status} = 'pending' THEN 0 ELSE 1 END`,
      desc(ideaJoinRequests.createdAt),
    );

  const rows = await (typeof limit === "number" && Number.isFinite(limit) && limit > 0
    ? baseQuery.limit(limit)
    : baseQuery);
  const applicantIds = Array.from(new Set(rows.map((row) => row.applicantId)));
  let applicantDirectory: Record<string, JoinRequestApplicant> = {};

  if (applicantIds.length > 0) {
    const applicants = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .where(inArray(users.id, applicantIds));

    applicantDirectory = Object.fromEntries(applicants.map((item) => [item.id, item]));
  }

  return rows.map((row) => normalizeJoinRequest(row, applicantDirectory[row.applicantId] ?? null));
}

export async function markJoinRequestsSeen(ownerId: string, ideaId: string, requestIds?: string[]) {
  const db = getDb();
  await requireIdeaAccess(ownerId, ideaId, "owner");

  await db.transaction(async (tx) => {
    let whereClause = and(eq(ideaJoinRequests.ideaId, ideaId), isNull(ideaJoinRequests.ownerSeenAt));
    if (requestIds && requestIds.length > 0) {
      whereClause = and(whereClause, inArray(ideaJoinRequests.id, requestIds));
    }

    const rows = await tx
      .select()
      .from(ideaJoinRequests)
      .where(whereClause);

    for (const row of rows) {
      if (row.ownerSeenAt) {
        continue;
      }

      const seenAt = new Date();
      const activity = appendActivity(row, buildActivityEntry("owner_seen", ownerId, null, seenAt));

      await tx
        .update(ideaJoinRequests)
        .set({
          ownerSeenAt: seenAt,
          updatedAt: seenAt,
          activityLog: activity,
        })
        .where(eq(ideaJoinRequests.id, row.id));
    }
  });
}

export async function updateJoinRequestReaction(ownerId: string, requestId: string, reaction: string | null) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const record = await fetchJoinRequest(tx, requestId);
    if (!record) {
      throw new Error("Join request not found");
    }
    const { row, applicant } = record;

    await requireIdeaAccess(ownerId, row.ideaId, "owner", { db: tx });

    const timestamp = new Date();
    const activity = appendActivity(
      row,
      buildActivityEntry("owner_reaction", ownerId, { reaction }, timestamp),
    );

    const [updated] = await tx
      .update(ideaJoinRequests)
      .set({
        ownerReaction: reaction,
        ownerSeenAt: row.ownerSeenAt ?? timestamp,
        updatedAt: timestamp,
        activityLog: activity,
      })
      .where(eq(ideaJoinRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update join request reaction");
    }

    return normalizeJoinRequest(updated, applicant);
  });
}

export async function archiveJoinRequest(ownerId: string, requestId: string) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const record = await fetchJoinRequest(tx, requestId);
    if (!record) {
      throw new Error("Join request not found");
    }
    const { row, applicant } = record;

    await requireIdeaAccess(ownerId, row.ideaId, "owner", { db: tx });

    const timestamp = new Date();
    const activity = appendActivity(
      row,
      buildActivityEntry("owner_archived", ownerId, null, timestamp),
    );

    const [updated] = await tx
      .update(ideaJoinRequests)
      .set({
        ownerArchivedAt: timestamp,
        ownerSeenAt: row.ownerSeenAt ?? timestamp,
        updatedAt: timestamp,
        activityLog: activity,
      })
      .where(eq(ideaJoinRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error("Failed to archive join request");
    }

    return normalizeJoinRequest(updated, applicant);
  });
}
