import { eq } from "drizzle-orm";

import { getDb } from "../lib/db/index";
import { ideaFeatures } from "../lib/db/schema";

async function main() {
  const ideaId = process.argv[2];
  if (!ideaId) {
    console.error("Usage: pnpm ts-node scripts/list-superstars.ts <idea-id>");
    process.exit(1);
  }

  const db = getDb();

  const rows = await db
    .select({
      id: ideaFeatures.id,
      title: ideaFeatures.title,
      completed: ideaFeatures.completed,
      superStarred: ideaFeatures.superStarred,
      starred: ideaFeatures.starred,
      deletedAt: ideaFeatures.deletedAt,
      updatedAt: ideaFeatures.updatedAt,
    })
    .from(ideaFeatures)
    .where(eq(ideaFeatures.ideaId, ideaId));

  if (rows.length === 0) {
    console.log("No features found for idea", ideaId);
    return;
  }

  console.table(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      completed: row.completed,
      starred: row.starred,
      superStarred: row.superStarred,
      deletedAt: row.deletedAt?.toISOString?.() ?? row.deletedAt ?? null,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
