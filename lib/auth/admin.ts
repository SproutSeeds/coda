import { DEVELOPER_EMAIL } from "@/lib/constants";
import { requireUser } from "@/lib/auth/session";

export async function requirePlatformAdmin() {
  const user = await requireUser();
  const adminEmail = DEVELOPER_EMAIL.toLowerCase();
  const userEmail = user.email?.toLowerCase();
  if (!userEmail || userEmail !== adminEmail) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function assertPlatformAdminEmail(email: string | null | undefined) {
  const adminEmail = DEVELOPER_EMAIL.toLowerCase();
  if (!email || email.toLowerCase() !== adminEmail) {
    throw new Error("Unauthorized");
  }
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.toLowerCase() === DEVELOPER_EMAIL.toLowerCase();
}
