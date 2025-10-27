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

export async function POST() {
  const db = getDb();
  // Try a few times to avoid rare code collisions
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const expiresAt = sql<Date>`now() + interval '10 minutes'`;
    try {
      const out = await withDevModeBootstrap(async () => {
        const [row] = await db
          .insert(devPairings)
          .values({ code, state: "pending", expiresAt })
          .returning();
        return row;
      });
      return NextResponse.json({ code: out.code, expiresAt: out.expiresAt });
    } catch {
      // On unique violation or missing table (handled by bootstrap), loop and try another code
    }
  }
  return NextResponse.json({ error: "Unable to allocate code" }, { status: 500 });
}
