import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_POSTGRES_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
  "NEON_POSTGRES_URL",
] as const;

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let cachedDevDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

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

  const connection = postgres(connectionString, {
    prepare: false,
    // Silence Postgres NOTICE messages (e.g., Neon welcome banner) in app logs
    onnotice: () => { },
  });
  cachedDb = drizzle(connection, { schema });
  return cachedDb;
}

// Development/DevMode database, optional separate connection for logs and runner state.
// Falls back to the primary DB when DEV_DATABASE_URL is not set.
export function getDevDb() {
  if (cachedDevDb) return cachedDevDb;
  const devUrl = process.env.DEV_DATABASE_URL;
  if (!devUrl) return getDb();
  const connection = postgres(devUrl, {
    prepare: false,
    onnotice: () => { },
  });
  cachedDevDb = drizzle(connection);
  return cachedDevDb;
}

export type ConnectionEnvKey = (typeof CONNECTION_ENV_KEYS)[number];

export const connectionEnvKeys: ConnectionEnvKey[] = [...CONNECTION_ENV_KEYS];
