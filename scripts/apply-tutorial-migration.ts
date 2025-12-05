import { config } from "dotenv";
config({ path: ".env.local" });

import { getDb } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  try {
    console.log("Applying tutorial columns...");
    await db.execute(sql`
      ALTER TABLE "journey_progress" ADD COLUMN IF NOT EXISTS "tutorial_step" integer DEFAULT 0 NOT NULL;
      ALTER TABLE "journey_progress" ADD COLUMN IF NOT EXISTS "tutorial_skipped" boolean DEFAULT false NOT NULL;
    `);
    console.log("Columns added successfully.");
  } catch (e) {
    console.error("Error adding columns:", e);
  }
  process.exit(0);
}

main();
