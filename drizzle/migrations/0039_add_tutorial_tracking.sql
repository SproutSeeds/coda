ALTER TABLE "journey_progress" ADD COLUMN "tutorial_step" integer DEFAULT 0 NOT NULL;
ALTER TABLE "journey_progress" ADD COLUMN "tutorial_skipped" boolean DEFAULT false NOT NULL;