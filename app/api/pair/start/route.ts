import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { devicePairings } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

const startSchema = z.object({
  deviceCode: z.string().uuid("Device code must be a valid UUID"),
  deviceName: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  const db = getDb();

  // Parse and validate request body
  const body = await req.json().catch(() => ({}));
  const parsed = startSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { deviceCode, deviceName } = parsed.data;

  // Clear any existing pending pairing for this device code
  try {
    await db
      .delete(devicePairings)
      .where(and(eq(devicePairings.deviceCode, deviceCode), eq(devicePairings.status, "pending")));
  } catch (err) {
    console.warn("[pair/start] Failed to clear old pending codes:", err);
  }

  // Create new pairing record
  try {
    const expiresAt = sql<Date>`now() + interval '10 minutes'`;
    const [row] = await db
      .insert(devicePairings)
      .values({
        deviceCode,
        deviceName: deviceName || null,
        status: "pending",
        expiresAt,
      })
      .returning();

    const baseUrl = process.env.NEXTAUTH_URL || "https://codacli.com";
    const authUrl = `${baseUrl}/pair?device_code=${deviceCode}`;

    return NextResponse.json({
      deviceCode: row.deviceCode,
      expiresAt: row.expiresAt,
      authUrl,
    });
  } catch (err) {
    console.error("[pair/start] Failed to create pairing:", err);
    return NextResponse.json(
      { error: "Failed to create pairing session" },
      { status: 500 }
    );
  }
}
