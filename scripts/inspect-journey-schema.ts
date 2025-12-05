import { config } from "dotenv";
config({ path: ".env.local" }); // Force load .env.local

import { getDb } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'journey_progress';
    `);
    console.log("Result:", result);
  } catch (e) {
    console.error("Error checking schema:", e);
  }
  process.exit(0);
}

main();