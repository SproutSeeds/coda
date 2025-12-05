import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema/monetization";

export type CreditLedgerEntry = typeof creditLedger.$inferSelect;

export async function listCreditLedgerEntries(userId: string, limit = 50): Promise<CreditLedgerEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
  return rows;
}
