import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  const db = getDb();
  const rows = await withDevModeBootstrap(() =>
    db
      .select()
      .from(devPairings)
      .where(and(eq(devPairings.userId, user.id), eq(devPairings.state, "approved")))
      .orderBy(desc(devPairings.approvedAt))
  );
  const devices = rows.map((r) => ({ id: r.id, runnerId: r.runnerId, approvedAt: r.approvedAt, createdAt: r.createdAt }));
  return NextResponse.json({ devices });
}

