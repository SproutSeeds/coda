DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_ledger_entry_type') THEN
    CREATE TYPE credit_ledger_entry_type AS ENUM ('purchase', 'debit', 'refund', 'adjustment', 'top_up', 'usage');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_purchase_status') THEN
    CREATE TYPE credit_purchase_status AS ENUM ('pending', 'completed', 'failed', 'canceled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS credit_balances (
  payer_type usage_payer_type NOT NULL,
  payer_id text NOT NULL,
  available_credits numeric NOT NULL DEFAULT 0,
  on_hold_credits numeric NOT NULL DEFAULT 0,
  auto_top_up_enabled boolean NOT NULL DEFAULT false,
  auto_top_up_credits numeric NOT NULL DEFAULT 0,
  auto_top_up_threshold numeric NOT NULL DEFAULT 0,
  auto_top_up_payment_method_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_balances_pk PRIMARY KEY (payer_type, payer_id)
);

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_type usage_payer_type NOT NULL,
  payer_id text NOT NULL,
  entry_type credit_ledger_entry_type NOT NULL,
  delta numeric NOT NULL,
  balance_after numeric NOT NULL,
  reference_id text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES auth_user(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_payer_created_at
  ON credit_ledger_entries (payer_type, payer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference
  ON credit_ledger_entries (reference_id);

CREATE TABLE IF NOT EXISTS credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_type usage_payer_type NOT NULL,
  payer_id text NOT NULL,
  provider text NOT NULL,
  provider_reference text,
  status credit_purchase_status NOT NULL DEFAULT 'pending',
  credits numeric NOT NULL,
  amount_usd numeric NOT NULL,
  initiated_by text REFERENCES auth_user(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_payer_status
  ON credit_purchases (payer_type, payer_id, status);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_provider_ref
  ON credit_purchases (provider, provider_reference);
