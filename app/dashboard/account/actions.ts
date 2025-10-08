"use server";

import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { trackEvent } from "@/lib/utils/analytics";
import { updatePasswordSchema } from "@/lib/validations/auth";

export type UpdatePasswordState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function updatePasswordAction(prevState: UpdatePasswordState, formData: FormData): Promise<UpdatePasswordState> {
  const user = await requireUser();
  const db = getDb();

  const input = updatePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword")?.toString() ?? undefined,
    newPassword: formData.get("newPassword")?.toString() ?? "",
  });

  if (!input.success) {
    const message = input.error.issues[0]?.message ?? "Invalid password format.";
    return { status: "error", message };
  }

  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!record) {
    return { status: "error", message: "User not found." };
  }

  if (record.passwordHash) {
    if (!input.data.currentPassword) {
      return { status: "error", message: "Enter your current password to update it." };
    }
    const matches = await compare(input.data.currentPassword, record.passwordHash);
    if (!matches) {
      return { status: "error", message: "Current password is incorrect." };
    }
  }

  const nextHash = await hash(input.data.newPassword, 12);
  await db.update(users).set({ passwordHash: nextHash }).where(eq(users.id, user.id));

  await trackEvent({ name: "auth_password_updated", properties: { userId: user.id } });
  revalidatePath("/dashboard/account");
  return { status: "success" };
}

export async function hasPassword(userId: string) {
  const db = getDb();
  const [record] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return Boolean(record?.passwordHash);
}
