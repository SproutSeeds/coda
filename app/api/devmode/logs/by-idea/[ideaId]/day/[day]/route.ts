import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devJobs, devLogs } from "@/lib/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { ensureDevModeSchema, shouldAutoBootstrap } from "@/lib/devmode/bootstrap";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ideaId: string; day: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ideaId, day } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: "Invalid day format" }, { status: 400 });

  const db = getDb();

  // Ensure logs table exists before querying in dev deployments
  try {
    const [reg] = await db.execute(sql`select to_regclass('public.dev_logs') as exist;`);
    const exists = (reg as any)?.exist ?? (reg as any)?.exists ?? null;
    if (!exists && shouldAutoBootstrap()) {
      await ensureDevModeSchema();
    }
  } catch {
    /* ignore bootstrap probes */
  }

  try {
    const startIso = `${day}T00:00:00.000Z`;
    const endIso = new Date(Date.parse(startIso) + 24 * 60 * 60 * 1000).toISOString();

    const rows = await db
      .select({
        id: devLogs.id,
        jobId: devLogs.jobId,
        level: devLogs.level,
        text: devLogs.text,
        seq: devLogs.seq,
        ts: devLogs.ts,
      })
      .from(devLogs)
      .innerJoin(devJobs, eq(devLogs.jobId, devJobs.id))
      .where(
        and(
          eq(devJobs.ideaId, ideaId),
          eq(devJobs.intent, "terminal-record"),
          sql`${devJobs.createdAt} >= ${startIso}::timestamptz AND ${devJobs.createdAt} < ${endIso}::timestamptz`,
        ),
      )
      .orderBy(asc(devLogs.ts), asc(devLogs.seq));

    return NextResponse.json({ logs: rows });
  } catch (err) {
    const message = (err as Error).message || "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
