import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, mfaCodes } from "@/lib/db/schema";
import { sendMfaCodeEmail } from "@/lib/auth/email";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { compare } from "bcryptjs";

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

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Generate a 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const db = getDb();

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user has a password set
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses magic link authentication. Please use the web login." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify password
    const passwordValid = await compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Rate limit: max 5 MFA codes per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCodes = await db
      .select()
      .from(mfaCodes)
      .where(
        and(
          eq(mfaCodes.userId, user.id),
          eq(mfaCodes.purpose, "device_login"),
          gt(mfaCodes.createdAt, oneHourAgo)
        )
      );

    if (recentCodes.length >= 5) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: corsHeaders }
      );
    }

    // Generate and save MFA code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(mfaCodes).values({
      userId: user.id,
      email: normalizedEmail,
      code,
      purpose: "device_login",
      expiresAt,
    });

    // Send email
    await sendMfaCodeEmail({
      email: normalizedEmail,
      code,
    });

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      email: normalizedEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Mask email
      expiresAt: expiresAt.toISOString(),
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[device-login] Unexpected error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "An unexpected error occurred", debug: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}
