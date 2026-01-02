import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideaCollaboratorInvites, ideaCollaborators, users } from "@/lib/db/schema";
import { enforceLimit } from "@/lib/limits/guard";
import { actorPays } from "@/lib/limits/payer";
import { requireIdeaAccess } from "@/lib/db/access";
import {
  normalizeCollaboratorEmail,
  validateCollaboratorInviteInput,
  validateCollaboratorRoleChange,
} from "@/lib/validations/collaborators";
import { logUsageCost } from "@/lib/usage/log-cost";
import type { CollaboratorInviteInput } from "@/lib/validations/collaborators";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

type CollaboratorRole = typeof ideaCollaborators.$inferSelect["role"];

type CollaboratorRow = {
  collaboratorId: string;
  ideaId: string;
  userId: string;
  role: CollaboratorRole;
  invitedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  email: string | null;
  name: string | null;
};

type InviteRow = typeof ideaCollaboratorInvites.$inferSelect;

export type IdeaCollaboratorSummary = {
  id: string;
  ideaId: string;
  userId: string;
  role: CollaboratorRole;
  email: string | null;
  name: string | null;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  isSelf: boolean;
};

export type IdeaCollaboratorInviteSummary = {
  id: string;
  ideaId: string;
  email: string;
  role: CollaboratorRole;
  token: string;
  invitedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type InviteCollaboratorResult =
  | { type: "collaborator"; collaborator: IdeaCollaboratorSummary }
  | { type: "invite"; invite: IdeaCollaboratorInviteSummary };

function mapCollaborator(row: CollaboratorRow, viewerId: string): IdeaCollaboratorSummary {
  return {
    id: row.collaboratorId,
    ideaId: row.ideaId,
    userId: row.userId,
    role: row.role,
    email: row.email,
    name: row.name,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isOwner: row.role === "owner",
    isSelf: row.userId === viewerId,
  };
}

function mapInvite(row: InviteRow): IdeaCollaboratorInviteSummary {
  return {
    id: row.id,
    ideaId: row.ideaId,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function fetchCollaboratorSummary(db: ReturnType<typeof getDb>, ideaId: string, collaboratorId: string, viewerId: string) {
  const [row] = await db
    .select({
      collaboratorId: ideaCollaborators.id,
      ideaId: ideaCollaborators.ideaId,
      userId: ideaCollaborators.userId,
      role: ideaCollaborators.role,
      invitedBy: ideaCollaborators.invitedBy,
      createdAt: ideaCollaborators.createdAt,
      updatedAt: ideaCollaborators.updatedAt,
      email: users.email,
      name: users.name,
    })
    .from(ideaCollaborators)
    .innerJoin(users, eq(users.id, ideaCollaborators.userId))
    .where(and(eq(ideaCollaborators.id, collaboratorId), eq(ideaCollaborators.ideaId, ideaId)))
    .limit(1);

  if (!row) {
    throw new Error("Collaborator not found");
  }

  return mapCollaborator(row, viewerId);
}

export async function listIdeaCollaborators(userId: string, ideaId: string) {
  await requireIdeaAccess(userId, ideaId, "owner");
  const db = getDb();

  const rows = await db
    .select({
      collaboratorId: ideaCollaborators.id,
      ideaId: ideaCollaborators.ideaId,
      userId: ideaCollaborators.userId,
      role: ideaCollaborators.role,
      invitedBy: ideaCollaborators.invitedBy,
      createdAt: ideaCollaborators.createdAt,
      updatedAt: ideaCollaborators.updatedAt,
      email: users.email,
      name: users.name,
    })
    .from(ideaCollaborators)
    .innerJoin(users, eq(users.id, ideaCollaborators.userId))
    .where(eq(ideaCollaborators.ideaId, ideaId))
    .orderBy(sql`CASE WHEN ${ideaCollaborators.role} = 'owner' THEN 0 ELSE 1 END`, ideaCollaborators.createdAt);

  return rows.map((row) => mapCollaborator(row, userId));
}

export async function listIdeaCollaboratorInvites(userId: string, ideaId: string) {
  await requireIdeaAccess(userId, ideaId, "owner");
  const db = getDb();

  const rows = await db
    .select()
    .from(ideaCollaboratorInvites)
    .where(and(eq(ideaCollaboratorInvites.ideaId, ideaId), isNull(ideaCollaboratorInvites.acceptedAt)))
    .orderBy(ideaCollaboratorInvites.createdAt);

  return rows.map(mapInvite);
}

type AssignableRole = CollaboratorInviteInput["role"];

export async function inviteCollaborator(userId: string, ideaId: string, input: { email: string; role: AssignableRole }) {
  const payload = validateCollaboratorInviteInput({
    email: input.email,
    role: input.role,
  });

  const db = getDb();
  const access = await requireIdeaAccess(userId, ideaId, "owner");

  const normalizedEmail = payload.email;
  const [existingCollaborator] = await db
    .select({ id: ideaCollaborators.id, role: ideaCollaborators.role, userId: ideaCollaborators.userId })
    .from(ideaCollaborators)
    .innerJoin(users, eq(users.id, ideaCollaborators.userId))
    .where(and(eq(ideaCollaborators.ideaId, ideaId), sql`lower(${users.email}) = ${normalizedEmail}`))
    .limit(1);

  if (existingCollaborator) {
    if (existingCollaborator.role === "owner") {
      throw new Error("Cannot change the owner role");
    }

    await db
      .update(ideaCollaborators)
      .set({ role: payload.role, updatedAt: new Date() })
      .where(eq(ideaCollaborators.id, existingCollaborator.id));

    const summary = await fetchCollaboratorSummary(db, ideaId, existingCollaborator.id, userId);
    return { type: "collaborator", collaborator: summary } satisfies InviteCollaboratorResult;
  }

  const [existingInvite] = await db
    .select()
    .from(ideaCollaboratorInvites)
    .where(
      and(
        eq(ideaCollaboratorInvites.ideaId, ideaId),
        sql`lower(${ideaCollaboratorInvites.email}) = ${normalizedEmail}`,
        isNull(ideaCollaboratorInvites.acceptedAt),
      ),
    )
    .limit(1);

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  if (existingInvite) {
    const [updated] = await db
      .update(ideaCollaboratorInvites)
      .set({
        role: payload.role,
        token,
        invitedBy: userId,
        expiresAt,
        createdAt: new Date(),
      })
      .where(eq(ideaCollaboratorInvites.id, existingInvite.id))
      .returning();

    const result = { type: "invite", invite: mapInvite(updated) } satisfies InviteCollaboratorResult;
    await logUsageCost({
      payer: actorPays(access.idea.userId),
      action: "collaborator.invite",
      metadata: {
        ideaId,
        inviteId: updated.id,
        actorId: userId,
        source: "email-invite-refresh",
      },
    });
    return result;
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingUser) {
    // Credit system disabled - skip limit enforcement
    // const limit = await enforceLimit({
    //   scope: { type: "idea", id: ideaId },
    //   metric: "collaborators.per_idea.lifetime",
    //   userId,
    //   credit: { amount: 1 },
    //   message: "This idea has reached the collaborator limit for your current plan.",
    // });

    const [created] = await db
      .insert(ideaCollaborators)
      .values({
        ideaId,
        userId: existingUser.id,
        role: payload.role,
        invitedBy: userId,
      })
      .onConflictDoUpdate({
        target: [ideaCollaborators.ideaId, ideaCollaborators.userId],
        set: { role: payload.role, updatedAt: new Date(), invitedBy: userId },
      })
      .returning();

    const summary = await fetchCollaboratorSummary(db, ideaId, created.id, userId);

    // Credit system disabled - skip usage cost logging
    // await logUsageCost({
    //   payer: limit.payer,
    //   action: "collaborator.add",
    //   creditsDebited: limit.credit?.amount ?? 0,
    //   metadata: {
    //     ideaId,
    //     collaboratorId: created.id,
    //     actorId: userId,
    //     source: "invite-existing-user",
    //     chargedPayer: limit.credit?.chargedPayer ?? null,
    //   },
    // });

    return { type: "collaborator", collaborator: summary } satisfies InviteCollaboratorResult;
  }

  const [invite] = await db
    .insert(ideaCollaboratorInvites)
    .values({
      ideaId,
      email: normalizedEmail,
      role: payload.role,
      token,
      invitedBy: userId,
      expiresAt,
    })
    .returning();

  const result = { type: "invite", invite: mapInvite(invite) } satisfies InviteCollaboratorResult;
  await logUsageCost({
    payer: actorPays(access.idea.userId),
    action: "collaborator.invite",
    metadata: {
      ideaId,
      inviteId: invite.id,
      actorId: userId,
      source: "email-invite",
    },
  });
  return result;
}

export async function updateIdeaCollaboratorRole(
  userId: string,
  ideaId: string,
  collaboratorId: string,
  input: { role: AssignableRole },
) {
  const payload = validateCollaboratorRoleChange({ role: input.role });
  const db = getDb();
  await requireIdeaAccess(userId, ideaId, "owner");

  const [target] = await db
    .select({ role: ideaCollaborators.role })
    .from(ideaCollaborators)
    .where(and(eq(ideaCollaborators.id, collaboratorId), eq(ideaCollaborators.ideaId, ideaId)))
    .limit(1);

  if (!target) {
    throw new Error("Collaborator not found");
  }

  if (target.role === "owner") {
    throw new Error("Cannot modify the owner role");
  }

  await db
    .update(ideaCollaborators)
    .set({ role: payload.role, updatedAt: new Date() })
    .where(eq(ideaCollaborators.id, collaboratorId));

  return fetchCollaboratorSummary(db, ideaId, collaboratorId, userId);
}

export async function removeIdeaCollaborator(userId: string, ideaId: string, collaboratorId: string) {
  const db = getDb();
  await requireIdeaAccess(userId, ideaId, "owner");

  const [target] = await db
    .select({ role: ideaCollaborators.role })
    .from(ideaCollaborators)
    .where(and(eq(ideaCollaborators.id, collaboratorId), eq(ideaCollaborators.ideaId, ideaId)))
    .limit(1);

  if (!target) {
    throw new Error("Collaborator not found");
  }

  if (target.role === "owner") {
    throw new Error("Cannot remove the owner");
  }

  await db.delete(ideaCollaborators).where(eq(ideaCollaborators.id, collaboratorId));
}

export async function leaveIdea(userId: string, ideaId: string) {
  const db = getDb();

  const [collaborator] = await db
    .select({ id: ideaCollaborators.id, role: ideaCollaborators.role })
    .from(ideaCollaborators)
    .where(and(eq(ideaCollaborators.ideaId, ideaId), eq(ideaCollaborators.userId, userId)))
    .limit(1);

  if (!collaborator) {
    return;
  }

  if (collaborator.role === "owner") {
    throw new Error("Owners cannot leave their own idea");
  }

  await db.delete(ideaCollaborators).where(eq(ideaCollaborators.id, collaborator.id));
}

export async function revokeIdeaCollaboratorInvite(userId: string, ideaId: string, inviteId: string) {
  const db = getDb();
  await requireIdeaAccess(userId, ideaId, "owner");
  await db
    .delete(ideaCollaboratorInvites)
    .where(and(eq(ideaCollaboratorInvites.id, inviteId), eq(ideaCollaboratorInvites.ideaId, ideaId)));
}

export async function acceptIdeaCollaboratorInvite(userId: string, token: string) {
  const db = getDb();

  const [invite] = await db
    .select()
    .from(ideaCollaboratorInvites)
    .where(eq(ideaCollaboratorInvites.token, token))
    .limit(1);

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.acceptedAt) {
    throw new Error("Invite already accepted");
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    throw new Error("Invite has expired");
  }

  const [userRecord] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRecord || !userRecord.email) {
    throw new Error("User email required to accept invite");
  }

  const normalizedUserEmail = normalizeCollaboratorEmail(userRecord.email);
  if (normalizedUserEmail !== normalizeCollaboratorEmail(invite.email)) {
    throw new Error("Invite email does not match your account");
  }

  const [existingCollaborator] = await db
    .select({ id: ideaCollaborators.id, role: ideaCollaborators.role })
    .from(ideaCollaborators)
    .where(and(eq(ideaCollaborators.ideaId, invite.ideaId), eq(ideaCollaborators.userId, userId)))
    .limit(1);

  if (existingCollaborator?.role === "owner") {
    await db
      .update(ideaCollaboratorInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(ideaCollaboratorInvites.id, invite.id));
    return invite.ideaId;
  }

  const timestamp = new Date();
  const rolePriority: Record<CollaboratorRole, number> = {
    viewer: 0,
    commenter: 1,
    editor: 2,
    owner: 3,
  };

  let limitResult: Awaited<ReturnType<typeof enforceLimit>> | null = null;
  let collaboratorId: string | null = existingCollaborator?.id ?? null;

  if (existingCollaborator) {
    const nextRole =
      rolePriority[invite.role] >= rolePriority[existingCollaborator.role]
        ? invite.role
        : existingCollaborator.role;

    if (nextRole !== existingCollaborator.role) {
      await db
        .update(ideaCollaborators)
        .set({ role: nextRole, updatedAt: timestamp })
        .where(eq(ideaCollaborators.id, existingCollaborator.id));
    }
  } else {
    // Credit system disabled - skip limit enforcement
    // limitResult = await enforceLimit({
    //   scope: { type: "idea", id: invite.ideaId },
    //   metric: "collaborators.per_idea.lifetime",
    //   userId,
    //   credit: { amount: 1 },
    //   message: "This idea has reached the collaborator limit for your current plan.",
    // });

    await db
      .insert(ideaCollaborators)
      .values({
        ideaId: invite.ideaId,
        userId,
        role: invite.role,
        invitedBy: invite.invitedBy ?? userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing({ target: [ideaCollaborators.ideaId, ideaCollaborators.userId] });

    const [created] = await db
      .select({ id: ideaCollaborators.id })
      .from(ideaCollaborators)
      .where(and(eq(ideaCollaborators.ideaId, invite.ideaId), eq(ideaCollaborators.userId, userId)))
      .limit(1);

    collaboratorId = created?.id ?? collaboratorId;
  }

  await db
    .update(ideaCollaboratorInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(ideaCollaboratorInvites.id, invite.id));

  // Credit system disabled - skip usage cost logging
  // if (limitResult && collaboratorId) {
  //   await logUsageCost({
  //     payer: limitResult.payer,
  //     action: "collaborator.add",
  //     creditsDebited: limitResult.credit?.amount ?? 0,
  //     metadata: {
  //       ideaId: invite.ideaId,
  //       collaboratorId,
  //       actorId: userId,
  //       source: "invite-accept",
  //     },
  //   });
  // }

  return invite.ideaId;
}
