DO $$ BEGIN
  CREATE TYPE "idea_join_request_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "idea_join_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id") ON DELETE CASCADE,
  "applicant_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "message" text NOT NULL,
  "status" "idea_join_request_status" NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  "processed_by" text REFERENCES "auth_user"("id") ON DELETE SET NULL,
  "resolution_note" text
);

CREATE INDEX IF NOT EXISTS "idx_idea_join_requests_idea"
  ON "idea_join_requests" ("idea_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_idea_join_requests_pending"
  ON "idea_join_requests" ("idea_id", "applicant_id")
  WHERE "status" = 'pending';
