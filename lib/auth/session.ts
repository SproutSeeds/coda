import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

const COOKIE_NAME = "coda-user";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieUser = store.get(COOKIE_NAME)?.value;
  if (cookieUser) {
    return { id: cookieUser };
  }
  return null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function signIn(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, userId, { path: "/", httpOnly: false });
}

export async function signOut() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
