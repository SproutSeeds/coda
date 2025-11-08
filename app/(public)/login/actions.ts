"use server";

import { createHash, randomBytes } from "node:crypto";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { passwordVerifications, users } from "@/lib/db/schema";
import { trackEvent } from "@/lib/utils/analytics";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { passwordSignUpSchema } from "@/lib/validations/auth";
import { sendPasswordVerificationEmail } from "@/lib/auth/email";
import { recordMeetupCheckIn } from "@/lib/db/meetup";
import { getCurrentUser } from "@/lib/auth/session";
import { actorPays } from "@/lib/limits/payer";
import { logUsageCost } from "@/lib/usage/log-cost";

export type PasswordSignUpState =
  | { status: "idle" }
  | { status: "pending"; email: string }
  | { status: "error"; message: string };

export async function registerWithPasswordAction(
  _prevState: PasswordSignUpState,
  formData: FormData,
): Promise<PasswordSignUpState> {
  const parsed = passwordSignUpSchema.safeParse({
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    confirmPassword: formData.get("confirmPassword")?.toString() ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to create account. Check your details and try again.";
    return { status: "error", message };
  }

  const { email, password } = parsed.data;
  const rate = await consumeRateLimit(`auth:password-signup:${email}`);
  if (!rate.success) {
    return { status: "error", message: "Too many requests. Please try again shortly." };
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing?.passwordHash) {
    return { status: "error", message: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await hash(password, 12);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.delete(passwordVerifications).where(eq(passwordVerifications.email, email));

    await tx.insert(passwordVerifications).values({
      email,
      userId: existing?.id ?? null,
      tokenHash,
      passwordHash,
      expiresAt,
      attempts: 0,
    });
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verificationUrl = new URL("/login/verify", baseUrl);
  verificationUrl.searchParams.set("token", token);

  try {
    await sendPasswordVerificationEmail({ email, url: verificationUrl.toString() });
  } catch {
    await db.delete(passwordVerifications).where(eq(passwordVerifications.tokenHash, tokenHash));
    return {
      status: "error",
      message: "We couldn't send the verification email. Please try again in a moment.",
    };
  }

  try {
    if (existing?.id) {
      await logUsageCost({
        payer: actorPays(existing.id, { source: "password-verification" }),
        action: "auth.email",
        metadata: { type: "password_verification", existingUser: true },
      });
    } else {
      await logUsageCost({
        payerType: "user",
        payerId: email,
        action: "auth.email",
        metadata: { type: "password_verification", existingUser: false },
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("auth: failed to log password verification email usage", { email, error });
    }
  }

  await trackEvent({
    name: "auth_password_created",
    properties: {
      mode: existing ? "attach_pending" : "signup_pending",
      ...(existing ? { userId: existing.id } : {}),
    },
  });

  return { status: "pending", email };
}

/**
 * Server action to record a meetup check-in.
 * Only available on Saturdays 11 AM - 1 PM Central Time (Pensacola, FL).
 * Returns success status and whether user was already checked in for this event.
 */
export async function checkInToMeetupAction() {
  const user = await getCurrentUser();

  // Verify check-in is open
  const now = new Date();
  const centralString = now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
  });
  const centralNow = new Date(centralString);
  const isSaturday = centralNow.getDay() === 6;
  const hour = centralNow.getHours();
  const isOpen = isSaturday && hour >= 11 && hour < 13;

  if (!isOpen) {
    return {
      success: false,
      error: "Check-in is only available on Saturdays from 11 AM to 1 PM Central Time",
    };
  }

  // Format event date as YYYY-MM-DD in Central Time
  const year = centralNow.getFullYear();
  const month = String(centralNow.getMonth() + 1).padStart(2, "0");
  const day = String(centralNow.getDate()).padStart(2, "0");
  const eventDate = `${year}-${month}-${day}`;

  // For authenticated users
  if (user?.id && user?.email) {
    try {
      const result = await recordMeetupCheckIn({
        userId: user.id,
        email: user.email,
        eventDate,
      });

      if (result.alreadyCheckedIn) {
        return {
          success: true,
          alreadyCheckedIn: true,
          message: "You're already checked in for this meeting",
        };
      }

      await trackEvent({
        name: "meetup_checkin",
        properties: { userId: user.id, eventDate },
      });

      return {
        success: true,
        alreadyCheckedIn: false,
        message: "Successfully checked in!",
      };
    } catch (error) {
      console.error("[checkInToMeetupAction] Failed to record check-in:", error);
      return {
        success: false,
        error: "Failed to record check-in. Please try again.",
      };
    }
  }

  // For non-authenticated users, validate email
  return {
    success: false,
    error: "Sign in to Coda to check in to the meetings.",
  };
}
