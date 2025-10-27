import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { devRunners } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(devRunners);
  return NextResponse.json({ runners: rows });
}
