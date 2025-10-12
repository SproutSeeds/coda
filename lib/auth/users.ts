import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function findOrCreateUserByEmail(email: string) {
  const db = getDb();
  const normalized = email.toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }

  const id = randomUUID();
  await db.insert(users).values({ id, email: normalized });

  return { id, email: normalized, name: null, emailVerified: null, image: null, passwordHash: null };
}
