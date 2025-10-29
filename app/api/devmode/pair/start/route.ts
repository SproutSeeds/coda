import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devPairings } from "@/lib/db/schema";
import { withDevModeBootstrap } from "@/lib/devmode/bootstrap";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/1/0
  let raw = "";
  for (let i = 0; i < 6; i++) raw += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

export async function POST(req: Request) {
  const db = getDb();
  const errors: string[] = [];

  // Accept deviceId from runner to enable stable runner ID reuse
  const body = (await req.json().catch(() => ({}))) as { deviceId?: string };
  const deviceId = body.deviceId?.trim() || null;

  // Try a few times to avoid rare code collisions
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const expiresAt = sql<Date>`now() + interval '10 minutes'`;
    try {
      const out = await withDevModeBootstrap(async () => {
        const [row] = await db
          .insert(devPairings)
          .values({ code, state: "pending", expiresAt, deviceId })
          .returning();
        return row;
      });
      return NextResponse.json({ code: out.code, expiresAt: out.expiresAt });
    } catch (err) {
      // On unique violation or missing table (handled by bootstrap), loop and try another code
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorCode = (err as { code?: string })?.code;
      errors.push(`Attempt ${i + 1}: [${errorCode || "UNKNOWN"}] ${errorMsg}`);
      console.error(`[pair/start] Attempt ${i + 1} failed:`, {
        code: errorCode,
        message: errorMsg,
        error: err,
      });
    }
  }

  console.error("[pair/start] All attempts exhausted. Errors:", errors);
  return NextResponse.json({
    error: "Unable to allocate code",
    details: process.env.NODE_ENV === "development" ? errors : undefined,
  }, { status: 500 });
}
