import { and, eq, isNull, or } from "drizzle-orm";

import { getDb } from "../lib/db/index";
import { ideaFeatures } from "../lib/db/schema";

async function main() {
  const db = getDb();

  const rows = await db
    .update(ideaFeatures)
    .set({
      starred: false,
      superStarred: false,
      superStarredAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ideaFeatures.completed, true),
        isNull(ideaFeatures.deletedAt),
        or(eq(ideaFeatures.starred, true), eq(ideaFeatures.superStarred, true)),
      ),
    )
    .returning({
      id: ideaFeatures.id,
      ideaId: ideaFeatures.ideaId,
      title: ideaFeatures.title,
    });

  if (rows.length === 0) {
    console.log("No completed features needed star cleanup.");
    return;
  }

  console.log(`Cleared stars on ${rows.length} completed feature(s).`);
  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
