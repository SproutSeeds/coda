-- Add refund request status enum
CREATE TYPE refund_request_status AS ENUM ('pending', 'approved', 'denied');

-- Create refund_requests table
CREATE TABLE refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

  -- What's being refunded
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_charge_id text,
  amount_cents integer NOT NULL,

  -- Request details
  reason text NOT NULL,
  status refund_request_status NOT NULL DEFAULT 'pending',

  -- Admin response
  admin_user_id text REFERENCES auth_user(id) ON DELETE SET NULL,
  admin_notes text,
  stripe_refund_id text,

  -- Timestamps
  purchased_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Create indexes
CREATE INDEX idx_refund_requests_user ON refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
