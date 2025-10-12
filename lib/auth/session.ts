import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { getThemePreference } from "@/lib/db/theme-preferences";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  theme?: "light" | "dark";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return null;
  }
  const cookieTheme = (await cookies()).get("coda-theme")?.value;
  let theme: "light" | "dark" | undefined = cookieTheme === "light" || cookieTheme === "dark" ? cookieTheme : undefined;
  if (!theme) {
    const preference = await getThemePreference(user.id);
    theme = preference?.theme;
  }
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
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
