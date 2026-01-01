import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { devicePairings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createDeviceToken } from "@/lib/auth/device-tokens";

export const runtime = "nodejs";

const authorizeSchema = z.object({
  deviceCode: z.string().uuid("Device code must be a valid UUID"),
});

export async function POST(req: Request) {
  // Require authenticated user
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Parse and validate request body
  const body = await req.json().catch(() => ({}));
  const parsed = authorizeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { deviceCode } = parsed.data;

  // Look up the pairing record
  const [pairing] = await db
    .select()
    .from(devicePairings)
    .where(eq(devicePairings.deviceCode, deviceCode))
    .limit(1);

  if (!pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  // Check if already authorized
  if (pairing.status === "authorized") {
    return NextResponse.json({ error: "Already authorized" }, { status: 400 });
  }

  // Check if expired
  const now = new Date();
  if (pairing.expiresAt < now || pairing.status === "expired") {
    // Mark as expired if not already
    if (pairing.status !== "expired") {
      await db
        .update(devicePairings)
        .set({ status: "expired" })
        .where(eq(devicePairings.id, pairing.id));
    }
    return NextResponse.json({ error: "Pairing expired" }, { status: 410 });
  }

  // Generate device token
  const { token, jti } = await createDeviceToken({
    id: user.id,
    email: user.email || "",
    name: user.name,
  });

  // Update pairing record with authorization
  const [updated] = await db
    .update(devicePairings)
    .set({
      status: "authorized",
      userId: user.id,
      token,
      jti,
      authorizedAt: new Date(),
    })
    .where(eq(devicePairings.id, pairing.id))
    .returning();

  return NextResponse.json({
    success: true,
    deviceName: updated.deviceName,
  });
}
