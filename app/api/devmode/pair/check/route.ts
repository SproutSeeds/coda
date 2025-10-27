import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";
import { and, eq, gt, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  if (!code || !/^[-A-Z0-9]{6,7}$/.test(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const db = getDb();
  const now = sql`now()` as any;
  const rows = await withDevModeBootstrap(() =>
    db
      .select()
      .from(devPairings)
      .where(and(eq(devPairings.code, code), gt(devPairings.expiresAt, now)))
      .limit(1),
  );
  const pairing = rows[0];
  if (!pairing) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (pairing.state === "approved" && pairing.runnerToken && pairing.runnerId) {
    return NextResponse.json({
      status: "approved",
      relayUrl: process.env.DEVMODE_RELAY_URL || "wss://relay-falling-butterfly-779.fly.dev",
      runnerToken: pairing.runnerToken,
      runnerId: pairing.runnerId,
    });
  }
  if (pairing.state === "consumed") return NextResponse.json({ status: "consumed" });
  if (pairing.state === "expired") return NextResponse.json({ status: "expired" });
  return NextResponse.json({ status: "pending" });
}
