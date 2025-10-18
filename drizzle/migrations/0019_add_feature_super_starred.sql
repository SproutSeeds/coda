ALTER TABLE "idea_features"
ADD COLUMN "super_starred" boolean DEFAULT false NOT NULL;

ALTER TABLE "idea_features"
ADD COLUMN "super_starred_at" timestamp with time zone;

CREATE INDEX "idx_feature_idea_super_star" ON "idea_features" ("idea_id", "super_starred");
