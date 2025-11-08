import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getUserUsageOverview } from "@/lib/usage/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getUserUsageOverview(user.id);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    userId: user.id,
    credit: overview.credit,
    costAggregates: overview.costAggregates,
    ledger: overview.recentLedger,
  });
}
