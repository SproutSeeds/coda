import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { updateJobState } from "@/lib/devmode/db";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  let body: { state?: "succeeded" | "failed" | "canceled" | "timed_out" } = {};
  try {
    body = await req.json();
  } catch {}
  const state = body.state;
  if (!state || !["succeeded", "failed", "canceled", "timed_out"].includes(state)) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }
  const row = await updateJobState(id, state, { finishedAt: new Date() });
  return NextResponse.json({ job: row });
}
