-- Add pgcrypto extension required for gen_random_uuid()
-- This is needed for DevMode tables (dev_jobs, dev_pairings, etc.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
