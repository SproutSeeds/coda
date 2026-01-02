import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mfaCodes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { sendMfaCodeEmail } from "@/lib/auth/email";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

const sendCodeSchema = z.object({
  purpose: z.enum(["device_pairing", "login"]).default("device_pairing"),
});

// Generate a 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  // Require authenticated user
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Parse request body
  const body = await req.json().catch(() => ({}));
  const parsed = sendCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { purpose } = parsed.data;

  // Rate limit: max 5 codes per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCodes = await db
    .select()
    .from(mfaCodes)
    .where(
      and(
        eq(mfaCodes.userId, user.id),
        eq(mfaCodes.purpose, purpose),
        gt(mfaCodes.createdAt, oneHourAgo)
      )
    );

  if (recentCodes.length >= 5) {
    return NextResponse.json(
      { error: "Too many verification codes requested. Please try again later." },
      { status: 429 }
    );
  }

  // Generate code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save to database
  try {
    await db.insert(mfaCodes).values({
      userId: user.id,
      email: user.email,
      code,
      purpose,
      expiresAt,
    });
  } catch (err) {
    console.error("[mfa/send-code] Failed to save code:", err);
    return NextResponse.json(
      { error: "Failed to generate verification code" },
      { status: 500 }
    );
  }

  // Send email
  try {
    await sendMfaCodeEmail({
      email: user.email,
      code,
    });
  } catch (err) {
    console.error("[mfa/send-code] Failed to send email:", err);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Mask email
    expiresAt: expiresAt.toISOString(),
  });
}
