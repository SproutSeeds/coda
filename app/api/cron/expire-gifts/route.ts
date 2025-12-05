import { NextResponse } from "next/server";
import { lt, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { gifts } from "@/lib/db/schema/monetization";

export async function GET(request: Request) {
  // Verify cron secret
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getDb();
  const now = new Date();

  // Find and expire all pending gifts that have passed their expiration date
  const expired = await db
    .update(gifts)
    .set({ status: "expired" })
    .where(
      and(
        eq(gifts.status, "pending"),
        lt(gifts.expiresAt, now)
      )
    )
    .returning({ id: gifts.id });

  console.log(`[Cron:expire-gifts] Expired ${expired.length} gifts`);

  return NextResponse.json({
    expired: expired.length,
    timestamp: now.toISOString(),
  });
}
