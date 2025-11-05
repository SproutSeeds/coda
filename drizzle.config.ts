import "dotenv/config";
import type { Config } from "drizzle-kit";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.DATABASE_POSTGRES_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.NEON_DATABASE_URL ??
  process.env.NEON_POSTGRES_URL ??
  "";

if (!connectionString) {
  throw new Error(
    "Database connection string missing. Set DATABASE_URL or a compatible Neon/Vercel Postgres variable.",
  );
}

export default {
  schema: ["./lib/db/schema.ts", "./lib/db/schema/*.ts"],
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
} satisfies Config;
