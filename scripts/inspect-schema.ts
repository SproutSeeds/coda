import { getDb } from "../lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function inspect() {
    console.log("Inspecting wallets table columns...");
    const result = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'wallets';
  `);

    console.log("Columns:", result);
    process.exit(0);
}

inspect().catch(console.error);
