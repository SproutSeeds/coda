import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, mfaCodes } from "@/lib/db/schema";
import { createDeviceToken } from "@/lib/auth/device-tokens";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

// CORS headers for desktop app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

const verifySchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export async function POST(req: Request) {
  try {
    const db = getDb();

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }

    const { email, code } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Find the most recent unexpired, unused code for this user
    const [mfaCode] = await db
      .select()
      .from(mfaCodes)
      .where(
        and(
          eq(mfaCodes.userId, user.id),
          eq(mfaCodes.purpose, "device_login"),
          eq(mfaCodes.used, false),
          gt(mfaCodes.expiresAt, now)
        )
      )
      .orderBy(desc(mfaCodes.createdAt))
      .limit(1);

    if (!mfaCode) {
      return NextResponse.json(
        { error: "No valid verification code found. Please request a new code." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check attempts
    if (mfaCode.attempts >= mfaCode.maxAttempts) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify code
    if (mfaCode.code !== code) {
      // Increment attempts
      await db
        .update(mfaCodes)
        .set({ attempts: mfaCode.attempts + 1 })
        .where(eq(mfaCodes.id, mfaCode.id));

      const attemptsRemaining = mfaCode.maxAttempts - mfaCode.attempts - 1;
      return NextResponse.json(
        {
          error: "Invalid verification code",
          attemptsRemaining,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Mark as used
    await db
      .update(mfaCodes)
      .set({
        used: true,
        usedAt: now,
      })
      .where(eq(mfaCodes.id, mfaCode.id));

    // Generate device token
    const { token, jti } = await createDeviceToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      token,
      jti,
      userId: user.id,
      email: user.email,
      name: user.name,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[device-verify] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500, headers: corsHeaders }
    );
  }
}
