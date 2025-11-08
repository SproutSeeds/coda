import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { updateJobState } from "@/lib/devmode/db";
import { finalizeUsageAndLogCost } from "@/lib/devmode/usage";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  const finishedAt = new Date();
  const row = await updateJobState(id, "canceled", { finishedAt });
  await finalizeUsageAndLogCost(row ?? undefined, finishedAt);
  return NextResponse.json({ job: row });
}
