-- Add JTI column for runner token revocation checks
alter table "dev_pairings" add column if not exists "runner_token_jti" text;

