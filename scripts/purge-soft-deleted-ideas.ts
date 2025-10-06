#!/usr/bin/env ts-node
import "dotenv/config";

import { lt } from "drizzle-orm";

import { getDb } from "../lib/db";
import { ideas } from "../lib/db/schema";

async function main() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const db = getDb();
  const result = await db.delete(ideas).where(lt(ideas.deletedAt, cutoff)).returning({ id: ideas.id });
  console.log(`Purged ${result.length} expired ideas`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
