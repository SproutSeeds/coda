import { eq } from "drizzle-orm";

import { getDb } from "./index";
import { themePreferences } from "./schema";

export async function getThemePreference(userId: string) {
  const db = getDb();
  const [record] = await db.select().from(themePreferences).where(eq(themePreferences.userId, userId)).limit(1);
  return record ?? null;
}

export async function clearThemePreference(userId: string) {
  const db = getDb();
  await db.delete(themePreferences).where(eq(themePreferences.userId, userId));
}

