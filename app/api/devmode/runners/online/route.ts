import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings, devRunners } from "@/lib/db/schema";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  const db = getDb();
  // Get runnerIds paired to this user and approved/not consumed
  const pairRows = await db
    .select({ runnerId: devPairings.runnerId })
    .from(devPairings)
    .where(and(eq(devPairings.userId, user.id), eq(devPairings.state, "approved"), sql`${devPairings.consumedAt} IS NULL`));
  const ids = pairRows.map((r) => r.runnerId).filter((v): v is string => !!v);
  if (ids.length === 0) return NextResponse.json({ online: false });
  const cutoff = sql`now() - interval '60 seconds'`;
  const runnerRows = await db
    .select()
    .from(devRunners)
    .where(and(inArray(devRunners.id, ids), eq(devRunners.status, "online"), gt(devRunners.lastHeartbeat, cutoff)))
    .limit(1);
  return NextResponse.json({ online: runnerRows.length > 0 });
}

