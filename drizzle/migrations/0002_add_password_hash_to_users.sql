ALTER TABLE "auth_user" ADD COLUMN IF NOT EXISTS "password_hash" text;
