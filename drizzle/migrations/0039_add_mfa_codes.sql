-- MFA verification codes for device pairing and login
CREATE TABLE IF NOT EXISTS mfa_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'device_pairing',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_codes_user_purpose ON mfa_codes(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_mfa_codes_email ON mfa_codes(email);
CREATE INDEX IF NOT EXISTS idx_mfa_codes_expires ON mfa_codes(expires_at);
