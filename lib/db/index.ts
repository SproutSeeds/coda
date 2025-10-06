import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let cachedDb: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Check your environment configuration.");
  }

  const connection = postgres(connectionString, { prepare: false });
  cachedDb = drizzle(connection);
  return cachedDb;
}
