import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  const db = getDb();
  const rows = await withDevModeBootstrap(() => db.select().from(devPairings).where(eq(devPairings.userId, user.id)).limit(1));
  const paired = !!rows[0];
  return NextResponse.json({ paired });
}

