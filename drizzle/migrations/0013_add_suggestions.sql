CREATE TABLE "suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" text NOT NULL,
  "submitted_by" text REFERENCES "auth_user"("id") ON DELETE SET NULL,
  "submitted_email" text,
  "title" text NOT NULL,
  "notes" text NOT NULL,
  "position" double precision NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "starred" boolean DEFAULT false NOT NULL,
  "deleted_at" timestamp with time zone,
  "undo_token" text,
  "undo_expires_at" timestamp with time zone,
  "completed" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX "idx_suggestions_owner_position" ON "suggestions" ("owner_id", "position");
CREATE INDEX "idx_suggestions_owner_star" ON "suggestions" ("owner_id", "starred");

CREATE TABLE "suggestion_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "suggestion_id" uuid NOT NULL REFERENCES "suggestions"("id") ON DELETE CASCADE,
  "author_id" text REFERENCES "auth_user"("id") ON DELETE SET NULL,
  "author_email" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_suggestion_updates_suggestion" ON "suggestion_updates" ("suggestion_id", "created_at");
