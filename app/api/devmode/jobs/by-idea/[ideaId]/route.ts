import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { listJobsByIdea } from "@/lib/devmode/db";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ ideaId: string }> }) {
  await requireUser();
  const { ideaId } = await ctx.params;
  const url = new URL(req.url);
  const intent = url.searchParams.get("intent");
  const rows = await listJobsByIdea(ideaId, 100);
  const filtered = intent ? rows.filter((r) => r.intent === intent) : rows;
  return NextResponse.json({ jobs: filtered });
}
