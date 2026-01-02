import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mfaCodes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

const verifyCodeSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
  purpose: z.enum(["device_pairing", "login"]).default("device_pairing"),
});

export async function POST(req: Request) {
  // Require authenticated user
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Parse request body
  const body = await req.json().catch(() => ({}));
  const parsed = verifyCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { code, purpose } = parsed.data;
  const now = new Date();

  // Find the most recent unexpired, unused code for this user and purpose
  const [mfaCode] = await db
    .select()
    .from(mfaCodes)
    .where(
      and(
        eq(mfaCodes.userId, user.id),
        eq(mfaCodes.purpose, purpose),
        eq(mfaCodes.used, false),
        gt(mfaCodes.expiresAt, now)
      )
    )
    .orderBy(desc(mfaCodes.createdAt))
    .limit(1);

  if (!mfaCode) {
    return NextResponse.json(
      { error: "No valid verification code found. Please request a new code." },
      { status: 400 }
    );
  }

  // Check attempts
  if (mfaCode.attempts >= mfaCode.maxAttempts) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please request a new code." },
      { status: 400 }
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
      { status: 400 }
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

  return NextResponse.json({
    success: true,
    verified: true,
  });
}
