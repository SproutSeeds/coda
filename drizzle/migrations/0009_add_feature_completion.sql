ALTER TABLE "idea_features"
ADD COLUMN "completed" boolean NOT NULL DEFAULT false;

ALTER TABLE "idea_features"
ADD COLUMN "completed_at" timestamp with time zone;
