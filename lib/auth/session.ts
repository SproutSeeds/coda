import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { getThemePreference } from "@/lib/db/theme-preferences";
import { ensureRequiredDocumentAcceptances } from "@/lib/legal/acceptance";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  theme?: "light" | "dark";
};

function isJwtSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: string; message?: string; name?: string; cause?: unknown };

  // Check error code
  if (err.code === "JWT_SESSION_ERROR") {
    return true;
  }

  // Check error name (NextAuth/jose errors)
  if (err.name === "JWTSessionError" || err.name === "JWTExpired") {
    return true;
  }

  // Check message for JWT-related errors
  if (typeof err.message === "string") {
    const msg = err.message.toLowerCase();
    if (msg.includes("decryption") || msg.includes("exp") || msg.includes("claim") || msg.includes("jwt")) {
      return true;
    }
  }

  // Recursively check cause (NextAuth wraps errors)
  if (err.cause) {
    return isJwtSessionError(err.cause);
  }

  // Check if error string representation contains JWT info
  const errorStr = String(error).toLowerCase();
  if (errorStr.includes("jwt") || errorStr.includes("exp") || errorStr.includes("claim")) {
    return true;
  }

  return false;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  let session;
  try {
    session = await auth();
  } catch (error) {
    if (isJwtSessionError(error)) {
      return null;
    }
    throw error;
  }
  const user = session?.user;
  const userId = user && typeof user === "object" ? (user as { id?: unknown }).id : undefined;
  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }
  await ensureRequiredDocumentAcceptances(userId);
  const cookieTheme = (await cookies()).get("coda-theme")?.value;
  let theme: "light" | "dark" | undefined = cookieTheme === "light" || cookieTheme === "dark" ? cookieTheme : undefined;
  if (!theme) {
    const preference = await getThemePreference(userId);
    theme = preference?.theme;
  }
  return {
    id: userId,
    email: (user as { email?: string | null })?.email ?? null,
    name: (user as { name?: string | null })?.name ?? null,
    theme,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
