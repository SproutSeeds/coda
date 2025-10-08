ALTER TABLE "ideas" ADD COLUMN "position" double precision;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM "ideas"
  WHERE "deleted_at" IS NULL
)
UPDATE "ideas"
SET "position" = ranked.rn * 1000
FROM ranked
WHERE ranked.id = "ideas"."id";

UPDATE "ideas"
SET "position" = 1000
WHERE "position" IS NULL;

ALTER TABLE "ideas" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "ideas" ALTER COLUMN "position" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp())) * 1000);

CREATE INDEX "idx_ideas_user_position" ON "ideas" ("user_id", "position");
