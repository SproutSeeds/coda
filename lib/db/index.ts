import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_POSTGRES_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
  "NEON_POSTGRES_URL",
] as const;

let cachedDb: ReturnType<typeof drizzle> | null = null;

function resolveConnectionString() {
  for (const key of CONNECTION_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  throw new Error(
    `Database connection string missing. Set one of: ${CONNECTION_ENV_KEYS.join(", ")}.`,
  );
}

export function getDb() {
  if (cachedDb) return cachedDb;

  const connectionString = resolveConnectionString();

  const connection = postgres(connectionString, { prepare: false });
  cachedDb = drizzle(connection);
  return cachedDb;
}

export type ConnectionEnvKey = (typeof CONNECTION_ENV_KEYS)[number];

export const connectionEnvKeys: ConnectionEnvKey[] = [...CONNECTION_ENV_KEYS];
