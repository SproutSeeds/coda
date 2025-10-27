import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jti = url.searchParams.get("jti") || "";
  const secret = process.env.RELAY_INTERNAL_SECRET;
  const provided = req.headers.get("x-relay-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!jti) return NextResponse.json({ active: false });
  const db = getDb();
  const [row] = await db
    .select()
    .from(devPairings)
    .where(and(eq(devPairings.runnerTokenJti, jti), eq(devPairings.state, "approved"), isNull(devPairings.consumedAt)))
    .limit(1);
  return NextResponse.json({ active: !!row });
}

