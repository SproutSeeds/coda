import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import { getDevDb as getDb } from "@/lib/db";
import { devJobs, devMessages, devRunners, devLogs } from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { incrementUsageBytes, initializeUsageSessionForJob } from "@/lib/devmode/usage";

export async function registerRunner({ id, name, capabilities }: { id: string; name: string; capabilities: string[] }) {
  const db = getDb();
  const now = sql`now()`;
  const [row] = await db
    .insert(devRunners)
    .values({ id, name, capabilities, status: "online", lastHeartbeat: sql`now()` })
    .onConflictDoUpdate({
      target: devRunners.id,
      set: { name, capabilities, status: "online", lastHeartbeat: now, updatedAt: now },
    })
    .returning();
  return row;
}

export async function touchRunner(id: string, status: "online" | "offline" | "stale" = "online") {
  const db = getDb();
  const [row] = await db
    .update(devRunners)
    .set({ status, lastHeartbeat: sql`now()`, updatedAt: sql`now()` })
    .where(eq(devRunners.id, id))
    .returning();
  return row;
}

export async function createJob(params: {
  ideaId: string;
  intent: string;
  idempotencyKey: string;
  repoProvider?: string | null;
  repo?: string | null;
  branch?: string | null;
  sha?: string | null;
  env?: Record<string, string> | null;
  timeoutMs?: number | null;
  createdBy: string;
}) {
  const db = getDb();
  const [existing] = await db.select().from(devJobs).where(eq(devJobs.idempotencyKey, params.idempotencyKey)).limit(1);
  if (existing) {
    await initializeUsageSessionForJob(existing);
    return existing;
  }

  const [row] = await db
    .insert(devJobs)
    .values({
      ideaId: params.ideaId,
      intent: params.intent,
      idempotencyKey: params.idempotencyKey,
      repoProvider: params.repoProvider ?? null,
      repo: params.repo ?? null,
      branch: params.branch ?? null,
      sha: params.sha ?? null,
      env: params.env ?? null,
      timeoutMs: params.timeoutMs ?? 900000,
      createdBy: params.createdBy,
      state: "queued",
    })
    .returning();
  await initializeUsageSessionForJob(row);
  return row;
}

export async function getJob(id: string) {
  const db = getDb();
  const [row] = await db.select().from(devJobs).where(eq(devJobs.id, id)).limit(1);
  return row ?? null;
}

export async function listJobsByIdea(ideaId: string, limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(devJobs)
    .where(eq(devJobs.ideaId, ideaId))
    .orderBy(desc(devJobs.createdAt))
    .limit(limit);
  return rows;
}

export async function updateJobState(
  id: string,
  state: typeof devJobs.$inferInsert["state"],
  patch: Partial<Pick<typeof devJobs.$inferInsert, "finishedAt" | "startedAt" | "previewUrl" | "branch" | "sha">> = {},
) {
  const db = getDb();
  const [row] = await db
    .update(devJobs)
    .set({ state, updatedAt: sql`now()`, ...patch })
    .where(eq(devJobs.id, id))
    .returning();
  return row;
}

export async function attachGitInfo(id: string, branch?: string | null, sha?: string | null) {
  const db = getDb();
  const [row] = await db
    .update(devJobs)
    .set({ branch: branch ?? null, sha: sha ?? null, updatedAt: sql`now()` })
    .where(eq(devJobs.id, id))
    .returning();
  return row;
}

export async function addMessage(params: {
  id: string; // cuid
  ideaId: string;
  jobId: string;
  runnerId?: string | null;
  sender: "user" | "codex" | "system";
  content: string;
  meta?: unknown;
}) {
  const db = getDb();
  // compute next seq
  const [{ max: maxSeq }] = await db
    .select({ max: max(devMessages.seq) })
    .from(devMessages)
    .where(sql`${devMessages.jobId} = ${params.jobId}::uuid`);
  const seq = (maxSeq ?? 0) + 1;
  const jobUuid = params.jobId as typeof devMessages.$inferInsert["jobId"];
  const [row] = await db
    .insert(devMessages)
    .values({ id: params.id, ideaId: params.ideaId, jobId: jobUuid, runnerId: params.runnerId ?? null, sender: params.sender, content: params.content, meta: params.meta ?? null, seq })
    .returning();
  return row;
}

export async function listMessages(jobId: string, afterSeq = 0, limit = 100) {
  const db = getDb();
  const rows = await db
    .select()
    .from(devMessages)
    .where(and(sql`${devMessages.jobId} = ${jobId}::uuid`, sql`${devMessages.seq} > ${afterSeq}`))
    .orderBy(asc(devMessages.seq))
    .limit(limit);
  return rows;
}

export async function appendLogs(jobId: string, lines: Array<{ level?: string; line: string }>) {
  const db = getDb();
  // fetch current max seq
  const [{ max: maxSeq }] = await db
    .select({ max: max(devLogs.seq) })
    .from(devLogs)
    .where(sql`${devLogs.jobId} = ${jobId}::uuid`);
  let seq = (maxSeq ?? 0) + 1;
  const values = lines.map((l) => ({
    id: randomUUID(),
    jobId: jobId as typeof devLogs.$inferInsert["jobId"],
    level: l.level === "warn" || l.level === "error" ? l.level : "info",
    text: l.line,
    seq: seq++,
  }));
  if (values.length === 0) return 0;
  await db.insert(devLogs).values(values);
  const totalBytes = values.reduce((sum, entry) => sum + Buffer.byteLength(entry.text ?? "", "utf8"), 0);
  if (totalBytes > 0) {
    await incrementUsageBytes(jobId, totalBytes);
  }
  return values.length;
}
