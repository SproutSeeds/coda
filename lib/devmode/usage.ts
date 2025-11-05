import { and, eq, isNull, sql } from "drizzle-orm";

import { getDevDb } from "@/lib/db";
import { devJobs, devUsageSessions } from "@/lib/db/schema";
import type { LimitPayerResolution } from "@/lib/limits/types";
import { actorPays, workspaceCovers } from "@/lib/limits/payer";
import { logUsageCost } from "@/lib/usage/log-cost";

type DevJobRow = typeof devJobs.$inferSelect;
type DevUsageSessionRow = typeof devUsageSessions.$inferSelect;

const SOURCE = "devmode.session";

function resolvePayerForUsage(usage: DevUsageSessionRow): LimitPayerResolution {
  if (usage.payerType === "workspace") {
    return workspaceCovers(usage.payerId, usage.userId, { source: SOURCE });
  }
  return actorPays(usage.payerId, { source: SOURCE });
}

async function ensureUsageRow(job: DevJobRow) {
  const db = getDevDb();
  await db
    .insert(devUsageSessions)
    .values({
      jobId: job.id,
      ideaId: job.ideaId,
      userId: job.createdBy,
      payerType: "user",
      payerId: job.createdBy,
      runnerId: job.runnerId ?? null,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
    })
    .onConflictDoNothing({ target: devUsageSessions.jobId });
}

export async function initializeUsageSessionForJob(job: DevJobRow) {
  await ensureUsageRow(job);
}

export async function markUsageSessionStarted(job: DevJobRow) {
  await ensureUsageRow(job);
  if (!job.startedAt) return;
  const db = getDevDb();
  await db.transaction(async (tx) => {
    if (job.runnerId) {
      await tx
        .update(devUsageSessions)
        .set({ runnerId: job.runnerId, updatedAt: new Date() })
        .where(eq(devUsageSessions.jobId, job.id));
    }
    await tx
      .update(devUsageSessions)
      .set({
        startedAt: job.startedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(devUsageSessions.jobId, job.id), isNull(devUsageSessions.startedAt)));
  });
}

export async function incrementUsageBytes(jobId: string, bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const db = getDevDb();
  const [updated] = await db
    .update(devUsageSessions)
    .set({ logBytes: sql`${devUsageSessions.logBytes} + ${bytes}`, updatedAt: new Date() })
    .where(eq(devUsageSessions.jobId, jobId))
    .returning({ jobId: devUsageSessions.jobId });

  if (updated) return;

  const [job] = await db.select().from(devJobs).where(eq(devJobs.id, jobId)).limit(1);
  if (!job) return;
  await ensureUsageRow(job);
  await db
    .update(devUsageSessions)
    .set({ logBytes: sql`${devUsageSessions.logBytes} + ${bytes}`, updatedAt: new Date() })
    .where(eq(devUsageSessions.jobId, jobId));
}

async function finalizeUsageSession(job: DevJobRow, finishedAt: Date) {
  await ensureUsageRow(job);
  const db = getDevDb();
  const usage = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(devUsageSessions)
      .where(eq(devUsageSessions.jobId, job.id))
      .limit(1);

    if (!existing) return null;

    if (existing.finishedAt) {
      if (job.runnerId && existing.runnerId !== job.runnerId) {
        const [patched] = await tx
          .update(devUsageSessions)
          .set({ runnerId: job.runnerId, updatedAt: new Date() })
          .where(eq(devUsageSessions.jobId, job.id))
          .returning();
        return patched ?? existing;
      }
      return existing;
    }

    const referenceStart = existing.startedAt ?? job.startedAt ?? job.createdAt ?? finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - referenceStart.getTime());

    const updateValues: Partial<typeof devUsageSessions.$inferInsert> = {
      finishedAt,
      durationMs,
      updatedAt: new Date(),
    };

    if (!existing.startedAt) {
      updateValues.startedAt = referenceStart;
    }

    if (!existing.runnerId && job.runnerId) {
      updateValues.runnerId = job.runnerId;
    }

    const [updated] = await tx
      .update(devUsageSessions)
      .set(updateValues)
      .where(eq(devUsageSessions.jobId, job.id))
      .returning();

    return updated ?? { ...existing, ...updateValues };
  });

  return usage;
}

async function markUsageCostLogged(jobId: string) {
  const db = getDevDb();
  await db
    .update(devUsageSessions)
    .set({ costLoggedAt: new Date(), updatedAt: new Date() })
    .where(eq(devUsageSessions.jobId, jobId));
}

export async function logUsageCostsForSession(usage: DevUsageSessionRow): Promise<boolean> {
  const payer = resolvePayerForUsage(usage);
  const tasks: Array<Promise<void>> = [];

  if (usage.durationMs > 0) {
    const minutes = usage.durationMs / 60000;
    tasks.push(
      logUsageCost({
        payer,
        action: "devmode.minute",
        quantity: minutes,
        metadata: {
          source: SOURCE,
          jobId: usage.jobId,
          ideaId: usage.ideaId,
          runnerId: usage.runnerId,
          durationMs: usage.durationMs,
        },
      }),
    );
  }

  if (usage.logBytes > 0) {
    tasks.push(
      logUsageCost({
        payer,
        action: "devmode.byte",
        quantity: usage.logBytes,
        metadata: {
          source: SOURCE,
          jobId: usage.jobId,
          ideaId: usage.ideaId,
          runnerId: usage.runnerId,
          bytes: usage.logBytes,
        },
      }),
    );
  }

  if (tasks.length === 0) {
    return false;
  }

  await Promise.all(tasks);
  return true;
}

export async function finalizeUsageAndLogCost(job: DevJobRow | undefined, finishedAt: Date) {
  if (!job) return;
  const usage = await finalizeUsageSession(job, finishedAt);
  if (!usage) return;
  if (usage.costLoggedAt) return;

  try {
    await logUsageCostsForSession(usage);
    await markUsageCostLogged(usage.jobId);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("devmode: failed to log session usage costs", { jobId: job.id, error });
    }
  }
}
