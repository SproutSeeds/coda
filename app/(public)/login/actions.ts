"use server";

import { redirect } from "next/navigation";

import { signIn, signOut } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    throw new Error("User id required");
  }
  await signIn(userId);
  redirect("/dashboard/ideas");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
