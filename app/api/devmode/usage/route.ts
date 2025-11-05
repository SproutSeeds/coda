import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getDevModeUsageSummary } from "@/lib/devmode/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDevModeUsageSummary(user.id);
  return NextResponse.json(summary);
}
