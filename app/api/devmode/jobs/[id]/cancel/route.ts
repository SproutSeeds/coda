import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { updateJobState } from "@/lib/devmode/db";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;
  const row = await updateJobState(id, "canceled");
  return NextResponse.json({ job: row });
}
