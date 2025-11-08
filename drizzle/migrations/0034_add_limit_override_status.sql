-- Extend limit_overrides with workflow metadata for admin review
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'limit_override_status') THEN
    CREATE TYPE "limit_override_status" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE "limit_overrides"
  ADD COLUMN IF NOT EXISTS "status" "limit_override_status",
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "resolved_by" text REFERENCES "auth_user"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "resolution_note" text;

-- Set default for existing rows
UPDATE "limit_overrides"
SET "status" = 'approved'
WHERE "status" IS NULL;

-- Make status required
ALTER TABLE "limit_overrides"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS "idx_limit_overrides_status" ON "limit_overrides" ("status", "created_at");
