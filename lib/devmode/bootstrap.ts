import { getDevDb as getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string; cause?: { code?: string } } | undefined)?.code ||
    (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  const message = (error as { message?: string } | undefined)?.message || String(error);
  return (
    code === "42P01" ||
    code === "42703" ||
    /relation\s+"dev_jobs"\s+does\s+not\s+exist/i.test(message) ||
    /relation\s+"dev_logs"\s+does\s+not\s+exist/i.test(message) ||
    /relation\s+"dev_messages"\s+does\s+not\s+exist/i.test(message) ||
    /relation\s+"dev_artifacts"\s+does\s+not\s+exist/i.test(message) ||
    /relation\s+"dev_pairings"\s+does\s+not\s+exist/i.test(message) ||
    /column\s+"[^"]+"\s+does\s+not\s+exist/i.test(message)
  );
}

export function shouldAutoBootstrap(): boolean {
  return process.env.DEVMODE_AUTO_BOOTSTRAP === "true" || process.env.NODE_ENV === "development";
}

export async function ensureDevModeSchema() {
  const db = getDb();
  // Create enums (idempotent via DO blocks)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "dev_runner_status" AS ENUM ('online','offline','stale');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "dev_job_state" AS ENUM ('queued','dispatched','running','uploading','succeeded','failed','canceled','timed_out');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "dev_preview_mode" AS ENUM ('direct','proxied');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Tables + indexes
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dev_runners" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "status" "dev_runner_status" NOT NULL DEFAULT 'offline',
      "last_heartbeat" timestamptz,
      "attestation" jsonb,
      "token_kid" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_runners_status" ON "dev_runners" ("status");`);

  // Ensure pgcrypto for gen_random_uuid exists, fallback to uuid-ossp if needed
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch { /* ignore */ }
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  } catch { /* ignore */ }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dev_jobs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "idea_id" text NOT NULL,
      "intent" text NOT NULL,
      "command" text,
      "args" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "env" jsonb,
      "timeout_ms" integer NOT NULL DEFAULT 900000,
      "repo_provider" text,
      "repo" text,
      "branch" text,
      "sha" text,
      "state" "dev_job_state" NOT NULL DEFAULT 'queued',
      "attempt" integer NOT NULL DEFAULT 0,
      "idempotency_key" text NOT NULL,
      "runner_id" text REFERENCES "dev_runners"("id") ON DELETE SET NULL,
      "preview_mode" "dev_preview_mode",
      "preview_url" text,
      "created_by" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "started_at" timestamptz,
      "finished_at" timestamptz
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "uniq_dev_jobs_idempotency" ON "dev_jobs" ("idempotency_key");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_jobs_idea_created" ON "dev_jobs" ("idea_id", "created_at");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_jobs_runner_state" ON "dev_jobs" ("runner_id", "state");`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dev_artifacts" (
      "id" text PRIMARY KEY,
      "job_id" uuid NOT NULL REFERENCES "dev_jobs"("id") ON DELETE CASCADE,
      "kind" text NOT NULL,
      "path" text NOT NULL,
      "size" integer NOT NULL,
      "mime" text NOT NULL,
      "sha256" text NOT NULL,
      "url" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_artifacts_job" ON "dev_artifacts" ("job_id");`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dev_messages" (
      "id" text PRIMARY KEY,
      "idea_id" text NOT NULL,
      "job_id" uuid NOT NULL REFERENCES "dev_jobs"("id") ON DELETE CASCADE,
      "runner_id" text REFERENCES "dev_runners"("id") ON DELETE SET NULL,
      "sender" text NOT NULL,
      "content" text NOT NULL,
      "meta" jsonb,
      "seq" integer NOT NULL,
      "ts" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_messages_job_seq" ON "dev_messages" ("job_id", "seq");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_messages_idea_ts" ON "dev_messages" ("idea_id", "ts");`);

  // Dev logs (recorded terminal output)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dev_logs" (
      "id" text PRIMARY KEY,
      "job_id" uuid NOT NULL REFERENCES "dev_jobs"("id") ON DELETE CASCADE,
      "level" text NOT NULL,
      "text" text NOT NULL,
      "seq" integer NOT NULL,
      "ts" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_logs_job_seq" ON "dev_logs" ("job_id", "seq");`);

  // Pairing codes (device pairing for runner tokens)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dev_pairings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "code" text NOT NULL UNIQUE,
      "state" text NOT NULL DEFAULT 'pending',
      "user_id" text,
      "runner_id" text,
      "runner_token" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "expires_at" timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
      "approved_at" timestamptz,
      "consumed_at" timestamptz
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_dev_pairings_code" ON "dev_pairings" ("code");`);
  // Columns added later (idempotent) — keep bootstrap in sync with migrations for dev
  try { await db.execute(sql`ALTER TABLE "dev_pairings" ADD COLUMN IF NOT EXISTS "runner_token_jti" text;`); } catch { /* ignore */ }
}

export async function withDevModeBootstrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isMissingRelation(err) && shouldAutoBootstrap()) {
      await ensureDevModeSchema();
      // retry once
      return await fn();
    }
    throw err;
  }
}
