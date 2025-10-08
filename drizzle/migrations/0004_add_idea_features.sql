CREATE TABLE "idea_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "notes" text NOT NULL,
  "position" double precision NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_feature_idea_position" ON "idea_features" ("idea_id", "position");
