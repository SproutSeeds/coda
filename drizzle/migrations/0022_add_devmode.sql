-- Dev Mode schema
DO $$ BEGIN
  CREATE TYPE "dev_runner_status" AS ENUM ('online','offline','stale');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "dev_job_state" AS ENUM ('queued','dispatched','running','uploading','succeeded','failed','canceled','timed_out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "dev_preview_mode" AS ENUM ('direct','proxied');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
CREATE INDEX IF NOT EXISTS "idx_dev_runners_status" ON "dev_runners" ("status");

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
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_dev_jobs_idempotency" ON "dev_jobs" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_dev_jobs_idea_created" ON "dev_jobs" ("idea_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_dev_jobs_runner_state" ON "dev_jobs" ("runner_id", "state");

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
CREATE INDEX IF NOT EXISTS "idx_dev_artifacts_job" ON "dev_artifacts" ("job_id");

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
CREATE INDEX IF NOT EXISTS "idx_dev_messages_job_seq" ON "dev_messages" ("job_id", "seq");
CREATE INDEX IF NOT EXISTS "idx_dev_messages_idea_ts" ON "dev_messages" ("idea_id", "ts");

