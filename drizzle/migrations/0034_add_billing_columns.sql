-- Add Stripe/billing fields to auth_user for plan and subscription tracking
ALTER TABLE auth_user
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;
