import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

export function createAuthAdapter() {
  const db = getDb();
  if (!db) {
    console.warn("[auth] Drizzle DB unavailable when creating adapter");
  }
  return DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
}
