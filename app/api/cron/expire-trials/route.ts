import { NextResponse } from "next/server";

import { expireTrialsBatch } from "@/lib/plans/trial-expiry";

export const runtime = "nodejs";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireTrialsBatch();
  return NextResponse.json({ processed: result.scanned, expired: result.expired });
}
