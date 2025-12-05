-- Visual Presets table for cloud-synced settings
CREATE TABLE IF NOT EXISTS "visual_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "settings" jsonb NOT NULL,
  "mode" text NOT NULL DEFAULT 'flow',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_visual_presets_user" ON "visual_presets" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_visual_presets_user_name" ON "visual_presets" ("user_id", "name");
