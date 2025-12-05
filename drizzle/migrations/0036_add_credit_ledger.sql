-- Credit Ledger Table for tracking all mana transactions
-- This provides an audit trail for subscription grants, booster purchases, usage, and refunds

-- Create the enum for credit/debit transaction type
DO $$ BEGIN
  CREATE TYPE credit_ledger_type AS ENUM ('credit', 'debit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the credit_ledger table
CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

  -- Transaction details
  amount integer NOT NULL, -- Mana amount (positive for both credit and debit)
  type credit_ledger_type NOT NULL, -- 'credit' = added, 'debit' = removed
  bucket text NOT NULL DEFAULT 'mana', -- 'mana' (subscription) or 'booster' (purchased)

  -- What caused this transaction
  reason text NOT NULL, -- e.g., 'subscription_grant', 'booster_purchase', 'usage', 'refund'
  reference_type text, -- 'subscription', 'booster', 'gift', 'refund', 'usage'
  reference_id text, -- Stripe charge ID, subscription ID, etc.

  -- Balance after this transaction (for auditing)
  balance_after integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON credit_ledger(user_id, created_at);
