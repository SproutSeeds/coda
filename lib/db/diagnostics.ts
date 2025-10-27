import { getDb, connectionEnvKeys } from "@/lib/db";
import { sql } from "drizzle-orm";

export function detectActiveDbEnvKey(): string | null {
  for (const key of connectionEnvKeys) {
    if (process.env[key]) return key;
  }
  return null;
}

export async function hasDevJobsTable(): Promise<boolean> {
  try {
    const db = getDb();
    const [row] = await db.execute(sql`SELECT to_regclass('public.dev_jobs') as exists`);
    const value = (row as unknown as { exists?: string | null })?.exists ?? null;
    return Boolean(value);
  } catch {
    return false;
  }
}

