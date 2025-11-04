ALTER TABLE "idea_join_requests"
  ADD COLUMN IF NOT EXISTS "owner_seen_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "owner_archived_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "owner_reaction" text,
  ADD COLUMN IF NOT EXISTS "activity_log" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "idx_idea_join_requests_pending_unseen"
  ON "idea_join_requests" ("idea_id")
  WHERE "status" = 'pending' AND "owner_seen_at" IS NULL;
