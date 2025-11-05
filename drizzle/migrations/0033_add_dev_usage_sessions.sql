-- Add dev_usage_sessions table to capture Dev Mode session metrics
CREATE TABLE IF NOT EXISTS "dev_usage_sessions" (
  "job_id" uuid PRIMARY KEY REFERENCES "dev_jobs"("id") ON DELETE CASCADE,
  "idea_id" text NOT NULL,
  "user_id" text NOT NULL,
  "payer_type" text NOT NULL,
  "payer_id" text NOT NULL,
  "runner_id" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "duration_ms" bigint NOT NULL DEFAULT 0,
  "log_bytes" bigint NOT NULL DEFAULT 0,
  "cost_logged_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_dev_usage_sessions_user" ON "dev_usage_sessions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_dev_usage_sessions_idea" ON "dev_usage_sessions" ("idea_id", "created_at");
