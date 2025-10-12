CREATE TYPE "theme_preference_theme" AS ENUM ('light', 'dark');
CREATE TYPE "theme_preference_source" AS ENUM ('explicit', 'system-default', 'restored');

CREATE TABLE "theme_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "theme" "theme_preference_theme" NOT NULL DEFAULT 'dark',
  "source" "theme_preference_source" NOT NULL DEFAULT 'system-default',
  "prompt_dismissed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "uniq_theme_preferences_user" ON "theme_preferences" ("user_id");

