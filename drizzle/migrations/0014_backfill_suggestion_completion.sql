DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suggestions'
      AND column_name = 'completed'
  ) THEN
    ALTER TABLE "suggestions"
      ADD COLUMN "completed" boolean DEFAULT false;

    UPDATE "suggestions"
      SET "completed" = false
      WHERE "completed" IS NULL;

    ALTER TABLE "suggestions"
      ALTER COLUMN "completed" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suggestions'
      AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE "suggestions"
      ADD COLUMN "completed_at" timestamp with time zone;
  END IF;
END $$;
