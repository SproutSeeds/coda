import { NextResponse } from "next/server";
import { getDevDb as getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Debug endpoint to check database connectivity and DevMode schema status.
 * Returns comprehensive diagnostic information about the environment.
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DEVMODE_AUTO_BOOTSTRAP: process.env.DEVMODE_AUTO_BOOTSTRAP,
      HAS_DEV_DATABASE_URL: !!process.env.DEV_DATABASE_URL,
      HAS_DATABASE_URL: !!process.env.DATABASE_URL,
      HAS_DEVMODE_JWT_SECRET: !!process.env.DEVMODE_JWT_SECRET,
      HAS_RELAY_INTERNAL_SECRET: !!process.env.RELAY_INTERNAL_SECRET,
      NEXT_PUBLIC_DEVMODE_RELAY_URL: process.env.NEXT_PUBLIC_DEVMODE_RELAY_URL,
      DEVMODE_RELAY_URL: process.env.DEVMODE_RELAY_URL,
    },
  };

  // Test database connectivity
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1 as health_check`);
    diagnostics.database = { connected: true };
  } catch (err) {
    diagnostics.database = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // Check for dev_pairings table
  try {
    const db = getDb();
    const [result] = await db.execute(
      sql`SELECT to_regclass('public.dev_pairings') as dev_pairings_exists;`,
    );
    diagnostics.schema = {
      dev_pairings_exists: (result as { dev_pairings_exists: string | null }).dev_pairings_exists !== null,
    };
  } catch (err) {
    diagnostics.schema = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Check for pgcrypto extension
  try {
    const db = getDb();
    const [result] = await db.execute(
      sql`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') as pgcrypto_installed;`,
    );
    diagnostics.extensions = {
      pgcrypto: (result as { pgcrypto_installed: boolean }).pgcrypto_installed,
    };
  } catch (err) {
    diagnostics.extensions = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Try to check table permissions
  try {
    const db = getDb();
    const [result] = await db.execute(
      sql`SELECT has_table_privilege(current_user, 'dev_pairings', 'INSERT') as can_insert;`,
    );
    diagnostics.permissions = {
      can_insert_dev_pairings: (result as { can_insert: boolean }).can_insert,
    };
  } catch (err) {
    diagnostics.permissions = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
