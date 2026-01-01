import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { devicePairings, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// CORS headers for desktop app pairing
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const deviceCode = searchParams.get("device_code");

  if (!deviceCode) {
    return NextResponse.json({ error: "Missing device_code" }, { status: 400, headers: corsHeaders });
  }

  // Look up the pairing record
  const [pairing] = await db
    .select()
    .from(devicePairings)
    .where(eq(devicePairings.deviceCode, deviceCode))
    .limit(1);

  if (!pairing) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }

  const now = new Date();

  // Check if expired
  if (pairing.expiresAt < now && pairing.status === "pending") {
    // Mark as expired
    await db
      .update(devicePairings)
      .set({ status: "expired" })
      .where(eq(devicePairings.id, pairing.id));

    return NextResponse.json({ status: "expired" }, { headers: corsHeaders });
  }

  if (pairing.status === "expired") {
    return NextResponse.json({ status: "expired" }, { headers: corsHeaders });
  }

  if (pairing.status === "pending") {
    return NextResponse.json({ status: "pending" }, { headers: corsHeaders });
  }

  if (pairing.status === "authorized") {
    // Get user info to return with token
    let email = "";
    let name: string | null = null;

    if (pairing.userId) {
      const [user] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, pairing.userId))
        .limit(1);

      if (user) {
        email = user.email;
        name = user.name;
      }
    }

    return NextResponse.json({
      status: "authorized",
      token: pairing.token,
      userId: pairing.userId,
      email,
      name,
    }, { headers: corsHeaders });
  }

  // Unknown status
  return NextResponse.json({ status: pairing.status }, { headers: corsHeaders });
}
