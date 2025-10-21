import { sql } from "drizzle-orm";

import { getDb } from "../lib/db";
import { users, ideas, verificationTokens } from "../lib/db/schema";

type Row = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  passwordLoginEnabled: boolean;
  activeIdeas: number;
  pendingMagicLinks: number;
};

async function main() {
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      passwordLoginEnabled: sql<boolean>`(${users.passwordHash} is not null)`,
      activeIdeas: sql<number>`(
        select count(*)
        from ${ideas}
        where ${ideas.userId} = ${users.id} and ${ideas.deletedAt} is null
      )`,
      pendingMagicLinks: sql<number>`(
        select count(*)
        from ${verificationTokens}
        where ${verificationTokens.identifier} = ${users.email}
          and ${verificationTokens.expires} > now()
      )`,
    })
    .from(users)
    .orderBy(users.email);

  const formatted: Row[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified ? row.emailVerified.toISOString() : null,
    passwordLoginEnabled: row.passwordLoginEnabled ?? false,
    activeIdeas: Number(row.activeIdeas ?? 0),
    pendingMagicLinks: Number(row.pendingMagicLinks ?? 0),
  }));

  if (formatted.length === 0) {
    console.log("No users found.");
    return;
  }

  console.table(formatted);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
