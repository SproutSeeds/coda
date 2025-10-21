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

  await trackEvent({
    name: "auth_password_created",
    properties: {
      mode: existing ? "attach_pending" : "signup_pending",
      ...(existing ? { userId: existing.id } : {}),
    },
  });

  return { status: "pending", email };
}
