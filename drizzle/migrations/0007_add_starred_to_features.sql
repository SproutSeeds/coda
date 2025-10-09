ALTER TABLE "idea_features"
ADD COLUMN "starred" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_feature_idea_star"
  ON "idea_features" ("idea_id", "starred");
