import { NextResponse } from "next/server";
import { ensureDevModeSchema } from "@/lib/devmode/bootstrap";
import { getDevDb as getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (isProd && !process.env.DEVMODE_AUTO_BOOTSTRAP) {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }
  try {
    await ensureDevModeSchema();
    const db = getDb();
    const [regs] = await db.execute(
      sql`select to_regclass('public.dev_jobs') as dev_jobs, to_regclass('public.dev_logs') as dev_logs;`,
    );
    return NextResponse.json({ ok: true, regs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || String(e) }, { status: 500 });
  }
}
