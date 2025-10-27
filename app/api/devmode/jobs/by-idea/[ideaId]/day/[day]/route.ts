import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getDevDb as getDb } from "@/lib/db";
import { devJobs } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ ideaId: string; day: string }> }) {
  await requireUser();
  const { ideaId, day } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Invalid day format, expected YYYY-MM-DD" }, { status: 400 });
  }
  const db = getDb();
  try {
    // Use explicit UTC day range to avoid timezone/date() pitfalls
    const startIso = `${day}T00:00:00.000Z`;
    const endIso = new Date(Date.parse(startIso) + 24 * 60 * 60 * 1000).toISOString();
    const deleted = await db
      .delete(devJobs)
      .where(
        and(
          eq(devJobs.ideaId, ideaId),
          eq(devJobs.intent, "terminal-record"),
          sql`${devJobs.createdAt} >= ${startIso}::timestamptz AND ${devJobs.createdAt} < ${endIso}::timestamptz`,
        ),
      )
      .returning({ id: devJobs.id });
    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (err) {
    const message = (err as Error).message || "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
