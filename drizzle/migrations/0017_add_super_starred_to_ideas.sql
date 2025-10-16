ALTER TABLE "ideas"
ADD COLUMN "super_starred" boolean DEFAULT false NOT NULL;

ALTER TABLE "ideas"
ADD COLUMN "super_starred_at" timestamp with time zone;

CREATE INDEX "idx_ideas_user_super_star" ON "ideas" ("user_id", "super_starred");
