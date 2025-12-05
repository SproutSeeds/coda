"use server";

import { cookies } from "next/headers";

const SELECTED_IDEA_COOKIE = "quest-hub-selected-idea";
const EXPANDED_STAGES_COOKIE = "quest-hub-expanded-stages";

export async function saveSelectedIdea(ideaId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SELECTED_IDEA_COOKIE, ideaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
}

export async function saveExpandedStages(stageIds: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(EXPANDED_STAGES_COOKIE, JSON.stringify(stageIds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
}

export async function getExpandedStages(): Promise<string[]> {
  const cookieStore = await cookies();
  const value = cookieStore.get(EXPANDED_STAGES_COOKIE)?.value;
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
