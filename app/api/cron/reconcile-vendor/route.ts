import { NextResponse } from "next/server";

import { reconcileVendorCosts } from "@/lib/usage/reconcile-vendor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const report = await reconcileVendorCosts({ days: 1 });
  return NextResponse.json({ ok: true, report });
}
