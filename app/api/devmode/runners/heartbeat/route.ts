import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devRunners } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { verifyRunnerTokenHS256 } from "@/lib/devmode/tokens";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const verified = await verifyRunnerTokenHS256(token);
  if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { runnerId } = verified;
  const db = getDb();
  // Upsert runner row with updated heartbeat
  const now = sql`now()`;
  await db
    .insert(devRunners)
    .values({ id: runnerId, name: runnerId, capabilities: [], status: "online", lastHeartbeat: now, updatedAt: now })
    .onConflictDoUpdate({ target: devRunners.id, set: { status: "online", lastHeartbeat: now, updatedAt: now } });
  return NextResponse.json({ ok: true });
}
