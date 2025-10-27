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

function isJwtSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const withCode = error as { code?: string; message?: string };
  if (withCode.code === "JWT_SESSION_ERROR") {
    return true;
  }
  if (typeof withCode.message === "string") {
    return withCode.message.toLowerCase().includes("decryption");
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
