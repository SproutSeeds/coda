import { NextResponse } from "next/server";

import { lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideas } from "@/lib/db/schema";

export async function GET() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const db = getDb();
  const purged = await db.delete(ideas).where(lt(ideas.deletedAt, cutoff)).returning({ id: ideas.id });
  return NextResponse.json({ removed: purged.length });
}
