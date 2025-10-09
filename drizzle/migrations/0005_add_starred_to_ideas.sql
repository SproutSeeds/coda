ALTER TABLE "ideas" ADD COLUMN "starred" boolean DEFAULT false NOT NULL;
CREATE INDEX "idx_ideas_user_star" ON "ideas" ("user_id", "starred");
