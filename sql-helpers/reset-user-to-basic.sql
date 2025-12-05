-- =====================================================
-- RESET USER TO BASIC PLAN (First-time user state)
-- =====================================================
-- Usage:
--   psql "$DATABASE_URL" -f sql-helpers/reset-user-to-basic.sql
--
-- Before running:
--   1. Update the email in the WHERE clauses below
--   2. Make sure you're targeting the correct database
-- =====================================================

BEGIN;

-- Step 1: Clear all credit transaction history (old schema)
DELETE FROM credit_ledger
WHERE user_id IN (
  SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'
);

-- Step 2: Clear all credit transaction history (new schema)
DELETE FROM credit_ledger_entries
WHERE payer_type = 'user' AND payer_id IN (
  SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'
);

-- Step 3: Clear credit purchases
DELETE FROM credit_purchases
WHERE payer_type = 'user' AND payer_id IN (
  SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'
);

-- Step 4: Clear credit balances (new schema)
DELETE FROM credit_balances
WHERE payer_type = 'user' AND payer_id IN (
  SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'
);

-- Step 5: Reset credit wallet to zero
DELETE FROM credit_wallet
WHERE user_id IN (
  SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'
);

-- Step 6: Reset user to basic plan with no subscription
UPDATE auth_user
SET
  plan_id = 'basic_10',
  trial_started_at = NULL,
  trial_ends_at = NULL,
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL,
  current_period_start = NULL,
  current_period_end = NULL
WHERE email = 'codyshanemitchell@gmail.com';

-- Step 7: Create fresh wallet with zero credits
INSERT INTO credit_wallet (user_id, balance_credits, base_credits, boost_credits)
SELECT id, 0, 0, 0
FROM auth_user
WHERE email = 'codyshanemitchell@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  balance_credits = 0,
  base_credits = 0,
  boost_credits = 0,
  updated_at = NOW();

-- Verify the reset
SELECT
  '=== USER STATE ===' as section,
  u.email,
  u.plan_id,
  u.trial_ends_at,
  u.stripe_subscription_id,
  cw.balance_credits,
  cw.base_credits,
  cw.boost_credits
FROM auth_user u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
WHERE u.email = 'codyshanemitchell@gmail.com';

-- Verify all history tables are clean
SELECT '=== HISTORY COUNTS ===' as section;
SELECT 'credit_ledger' as table_name, COUNT(*) as count
FROM credit_ledger
WHERE user_id IN (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com')
UNION ALL
SELECT 'credit_ledger_entries', COUNT(*)
FROM credit_ledger_entries
WHERE payer_type = 'user' AND payer_id IN (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com')
UNION ALL
SELECT 'credit_purchases', COUNT(*)
FROM credit_purchases
WHERE payer_type = 'user' AND payer_id IN (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com')
UNION ALL
SELECT 'credit_balances', COUNT(*)
FROM credit_balances
WHERE payer_type = 'user' AND payer_id IN (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com');

COMMIT;

-- =====================================================
-- Expected Result:
-- - Plan: basic_10
-- - Credits: 0 (balance: 0, base: 0, boost: 0)
-- - All history counts: 0
-- - No Stripe subscription
-- - No trial
-- =====================================================
