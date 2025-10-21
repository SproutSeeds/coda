import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";

import { encode } from "next-auth/jwt";
import { eq } from "drizzle-orm";

import { authOptions } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { passwordVerifications, users } from "@/lib/db/schema";
import { ensureRequiredDocumentAcceptances } from "@/lib/legal/acceptance";
import { trackEvent } from "@/lib/utils/analytics";

const COOKIE_NAME = {
  insecure: {
    session: "next-auth.session-token",
    callback: "next-auth.callback-url",
  },
  secure: {
    session: "__Secure-next-auth.session-token",
    callback: "__Secure-next-auth.callback-url",
  },
} as const;

const DEFAULT_REDIRECT = "/dashboard/ideas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL(`/login?error=missing-token`, url.origin));
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();

  const [record] = await db
    .select()
    .from(passwordVerifications)
    .where(eq(passwordVerifications.tokenHash, tokenHash))
    .limit(1);

  if (!record) {
    return NextResponse.redirect(new URL(`/login?error=invalid-token`, url.origin));
  }

  if (record.expiresAt < new Date()) {
    await db.delete(passwordVerifications).where(eq(passwordVerifications.id, record.id));
    return NextResponse.redirect(new URL(`/login?error=token-expired`, url.origin));
  }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    if (record.userId) {
      const [existingUser] = await tx.select().from(users).where(eq(users.id, record.userId)).limit(1);
      if (!existingUser) {
        await tx.delete(passwordVerifications).where(eq(passwordVerifications.id, record.id));
        return { error: "missing-user" } as const;
      }

      await tx
        .update(users)
        .set({ passwordHash: record.passwordHash, emailVerified: existingUser.emailVerified ?? now })
        .where(eq(users.id, existingUser.id));

      await tx.delete(passwordVerifications).where(eq(passwordVerifications.id, record.id));

      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
        mode: "attach_confirmed" as const,
      };
    }

    const [maybeExistingUser] = await tx.select().from(users).where(eq(users.email, record.email)).limit(1);
    if (maybeExistingUser) {
      await tx
        .update(users)
        .set({ passwordHash: record.passwordHash, emailVerified: maybeExistingUser.emailVerified ?? now })
        .where(eq(users.id, maybeExistingUser.id));

      await tx.delete(passwordVerifications).where(eq(passwordVerifications.id, record.id));

      return {
        user: {
          id: maybeExistingUser.id,
          email: maybeExistingUser.email,
          name: maybeExistingUser.name,
        },
        mode: "attach_confirmed" as const,
      };
    }

    const newUserId = randomUUID();
    await tx.insert(users).values({
      id: newUserId,
      email: record.email,
      passwordHash: record.passwordHash,
      emailVerified: now,
    });

    await tx.delete(passwordVerifications).where(eq(passwordVerifications.id, record.id));

    return {
      user: {
        id: newUserId,
        email: record.email,
        name: null,
      },
      mode: "signup_confirmed" as const,
    } as const;
  });

  if (!result || "error" in result) {
    return NextResponse.redirect(new URL(`/login?error=account-error`, url.origin));
  }

  const { user, mode } = result;

  await ensureRequiredDocumentAcceptances(user.id);

  await trackEvent({
    name: "auth_password_created",
    properties: { userId: user.id, mode },
  });

  const secret = authOptions.secret ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue sessions.");
  }

  const sessionStrategy = authOptions.session?.strategy ?? "jwt";
  if (sessionStrategy !== "jwt") {
    throw new Error("Password verification session issuance only supports JWT sessions.");
  }

  const maxAge = authOptions.session?.maxAge ?? 365 * 24 * 60 * 60;
  const jwtToken = {
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
  };

  const sessionToken = await encode({ token: jwtToken, secret, maxAge });

  const nextAuthUrl = process.env.NEXTAUTH_URL ?? url.origin;
  const useSecureCookies = nextAuthUrl.startsWith("https://");
  const names = useSecureCookies ? COOKIE_NAME.secure : COOKIE_NAME.insecure;

  const response = NextResponse.redirect(new URL(DEFAULT_REDIRECT, nextAuthUrl));
  response.cookies.set(names.session, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge,
  });
  response.cookies.set(names.callback, DEFAULT_REDIRECT, {
    httpOnly: false,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge,
  });

  return response;
}
