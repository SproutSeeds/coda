import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { addMessage, listMessages, getJob } from "@/lib/devmode/db";
import { cuid } from "@/lib/utils/id";
import { publish } from "@/lib/devmode/bus";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const afterSeq = Number(url.searchParams.get("afterSeq") ?? "0");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? "100"));
  const items = await listMessages(id, isFinite(afterSeq) ? afterSeq : 0, limit);
  return NextResponse.json({ items });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Missing content" }, { status: 400 });
  const created = await addMessage({ id: cuid(), ideaId: job.ideaId, jobId: job.id, sender: "user", content });
  publish({ type: "message", jobId: job.id, seq: created.seq, ts: Date.now(), sender: "user", content });
  return NextResponse.json({ message: created });
}
