import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { mintRunnerToken } from "@/lib/devmode/session";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { code?: string; runnerId?: string };
  const code = (body.code || "").toUpperCase();
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
  if (!pairing) return NextResponse.json({ error: "Code not found or expired" }, { status: 404 });
  if (pairing.state === "approved") return NextResponse.json({ ok: true });

  const runnerId = (body.runnerId && body.runnerId.trim()) || `runner-${crypto.randomUUID().slice(0, 8)}`;
  const jti = pairing.id as string;
  const token = await mintRunnerToken({ runnerId, userId: user.id, jti });
  const [updated] = await withDevModeBootstrap(() =>
    db
      .update(devPairings)
      .set({ state: "approved", approvedAt: sql`now()`, userId: user.id, runnerId, runnerToken: token, runnerTokenJti: jti })
      .where(eq(devPairings.id, pairing.id))
      .returning(),
  );
  return NextResponse.json({ ok: true, runnerId: updated.runnerId });
}
