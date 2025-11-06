import { NextResponse } from "next/server";

import { reconcileVendorCosts } from "@/lib/usage/reconcile-vendor";
import { syncProviderCosts } from "@/lib/usage/provider-ledger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [providerResults, report] = await Promise.all([
    syncProviderCosts({ window: "day" }),
    reconcileVendorCosts({ days: 1 }),
  ]);

  return NextResponse.json({ ok: true, providerResults, report });
}
