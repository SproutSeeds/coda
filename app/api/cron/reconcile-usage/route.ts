import { NextResponse } from "next/server";

import { reconcileUsageCounters } from "@/lib/limits/reconcile";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await reconcileUsageCounters();
  return NextResponse.json({ ok: true, processed: results });
}
