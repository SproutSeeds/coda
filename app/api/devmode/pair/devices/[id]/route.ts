import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";

export const runtime = "nodejs";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const db = getDb();
  const { id } = await context.params;
  const [row] = await withDevModeBootstrap(() =>
    db.select().from(devPairings).where(and(eq(devPairings.id, id), eq(devPairings.userId, user.id))).limit(1),
  );
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Mark consumed (revoked). Note: HS256 tokens cannot be invalidated centrally without rotation; this marks intent.
  await db
    .update(devPairings)
    .set({ state: "consumed", consumedAt: sql`now()` })
    .where(eq(devPairings.id, id));
  return NextResponse.json({ ok: true });
}
