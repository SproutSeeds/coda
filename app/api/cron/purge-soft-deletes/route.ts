import { NextResponse } from "next/server";

import { lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ideas } from "@/lib/db/schema";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const db = getDb();
  const purged = await db.delete(ideas).where(lt(ideas.deletedAt, cutoff)).returning({ id: ideas.id });
  return NextResponse.json({ removed: purged.length });
}
