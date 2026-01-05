-- Add created_at timestamp to auth_user table
-- This tracks when users first signed up

ALTER TABLE auth_user ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill existing users with their email_verified date if available,
-- otherwise use current timestamp
UPDATE auth_user
SET created_at = COALESCE(email_verified, NOW())
WHERE created_at IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE auth_user ALTER COLUMN created_at SET NOT NULL;

-- Add index for sorting by join date
CREATE INDEX IF NOT EXISTS idx_auth_user_created_at ON auth_user(created_at);
