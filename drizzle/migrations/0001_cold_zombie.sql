CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"undo_token" text,
	"undo_expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_ideas_user_created_at" ON "ideas" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_ideas_search_trgm" ON "ideas" USING GIN ("title" gin_trgm_ops, "notes" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_ideas_active" ON "ideas" ("user_id") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "idea_search_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"results_count" integer NOT NULL,
	"queried_at" timestamp with time zone DEFAULT now() NOT NULL
);
