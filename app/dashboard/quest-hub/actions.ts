"use server";

import { cookies } from "next/headers";

const SELECTED_IDEA_COOKIE = "quest-hub-selected-idea";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Save the selected idea ID to a cookie
 */
export async function saveSelectedIdea(ideaId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SELECTED_IDEA_COOKIE, ideaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}
