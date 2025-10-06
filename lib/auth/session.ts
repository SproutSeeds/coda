import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return null;
  }
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
