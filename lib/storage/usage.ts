import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { fileStorageUsage } from "@/lib/db/schema/monetization";
import { PLAN_IDS } from "@/lib/plans/constants";
import { getUserPlan, requirePlanById } from "@/lib/plans/service";

type DbClient = ReturnType<typeof getDb>;
type TransactionCallback = Parameters<DbClient["transaction"]>[0];
type TransactionClient = TransactionCallback extends (tx: infer Tx, ...args: unknown[]) => unknown ? Tx : never;
type DbOrTx = DbClient | TransactionClient;

const GIGABYTE = 1024 ** 3;

function resolveDb(db?: DbOrTx): DbOrTx {
  return db ?? getDb();
}

export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageLimitError";
  }
}

export async function ensureStorageUsageRow(userId: string, db?: DbOrTx) {
  const resolved = resolveDb(db);
  await resolved
    .insert(fileStorageUsage)
    .values({ userId, usedBytes: 0 })
    .onConflictDoNothing({ target: fileStorageUsage.userId });
}

export async function getStorageUsage(userId: string, options: { db?: DbOrTx } = {}): Promise<number> {
  const db = resolveDb(options.db);
  await ensureStorageUsageRow(userId, db);
  const [row] = await db.select({ usedBytes: fileStorageUsage.usedBytes }).from(fileStorageUsage).where(eq(fileStorageUsage.userId, userId)).limit(1);
  return row?.usedBytes ?? 0;
}

export async function incrementStorageUsage(userId: string, bytes: number, options: { db?: DbOrTx } = {}) {
  if (bytes <= 0) return;
  const db = resolveDb(options.db);
  await ensureStorageUsageRow(userId, db);
  await db
    .update(fileStorageUsage)
    .set({ usedBytes: sql`${fileStorageUsage.usedBytes} + ${bytes}`, updatedAt: new Date() })
    .where(eq(fileStorageUsage.userId, userId));
}

export async function decrementStorageUsage(userId: string, bytes: number, options: { db?: DbOrTx } = {}) {
  if (bytes <= 0) return;
  const db = resolveDb(options.db);
  await ensureStorageUsageRow(userId, db);
  await db
    .update(fileStorageUsage)
    .set({ usedBytes: sql`GREATEST(${fileStorageUsage.usedBytes} - ${bytes}, 0)`, updatedAt: new Date() })
    .where(eq(fileStorageUsage.userId, userId));
}

export async function assertStorageCapacity(userId: string, incomingBytes: number, options: { addonStorageBytes?: number; db?: DbOrTx } = {}) {
  if (incomingBytes <= 0) return;
  const db = resolveDb(options.db);
  await ensureStorageUsageRow(userId, db);

  const planSummary = await getUserPlan(userId, { db });
  const plan = planSummary?.plan ?? (await requirePlanById(PLAN_IDS.BASIC, { db }));
  const limitBytes = Math.floor(plan.storageGb * GIGABYTE + (options.addonStorageBytes ?? 0));

  const [usage] = await db.select().from(fileStorageUsage).where(eq(fileStorageUsage.userId, userId)).limit(1);
  const usedBytes = usage?.usedBytes ?? 0;
  const projected = usedBytes + incomingBytes;

  if (projected > limitBytes) {
    throw new StorageLimitError("You’ve hit your storage limit. Delete files or purchase more storage.");
  }
}

export async function getStorageSummary(userId: string, options: { db?: DbOrTx } = {}) {
  const db = resolveDb(options.db);
  const planSummary = await getUserPlan(userId, { db });
  const plan = planSummary?.plan ?? (await requirePlanById(PLAN_IDS.BASIC, { db }));
  const usedBytes = await getStorageUsage(userId, { db });
  const limitBytes = Math.floor(plan.storageGb * GIGABYTE);
  return {
    planId: plan.id,
    usedBytes,
    limitBytes,
  };
}
