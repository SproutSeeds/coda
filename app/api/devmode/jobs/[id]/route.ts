import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getJob } from "@/lib/devmode/db";
import { getDevDb as getDb } from "@/lib/db";
import { devJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  const db = getDb();
  await db.delete(devJobs).where(eq(devJobs.id, id));
  return NextResponse.json({ ok: true });
}
