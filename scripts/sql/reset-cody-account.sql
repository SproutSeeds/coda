-- FULL RESET: Cody's Account
-- Email: codyshanemitchell@gmail.com
-- Resets to the Wanderer (free trial) plan, zeros all credits, clears ledger history

-- DANGER: This permanently deletes credit history!

-- Step 1: Show current state
SELECT '=== CURRENT STATE ===' AS section;

SELECT
  u.email,
  u.plan_id AS current_plan,
  u.stripe_customer_id,
  u.stripe_subscription_id,
  cw.base_credits,
  cw.boost_credits,
  cw.balance_credits,
  COUNT(cl.id) AS ledger_entries_to_delete
FROM auth_user u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
LEFT JOIN credit_ledger cl ON cl.user_id = u.id
WHERE u.email = 'codyshanemitchell@gmail.com'
GROUP BY u.id, u.email, u.plan_id, u.stripe_customer_id, u.stripe_subscription_id,
         cw.base_credits, cw.boost_credits, cw.balance_credits;

-- Step 2: Show what will be deleted
SELECT '=== LEDGER HISTORY (WILL BE DELETED) ===' AS section;

SELECT
  created_at,
  reason,
  delta_credits,
  ref_type,
  ref_id
FROM credit_ledger
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com')
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Uncomment to execute the full reset

/*
BEGIN;

-- Delete all ledger entries
DELETE FROM credit_ledger
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com');

-- Zero out all credits
UPDATE credit_wallet
SET base_credits = 0,
    boost_credits = 0,
    balance_credits = 0,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com');

-- Reset to Wanderer plan (keeps Stripe data for history/reference)
UPDATE auth_user
SET plan_id = 'trial'
WHERE email = 'codyshanemitchell@gmail.com';

COMMIT;

SELECT '✅ Account reset complete!' AS status;
*/

-- Step 4: Verify after reset (uncomment after running reset)
/*
SELECT
  '=== AFTER RESET ===' AS section,
  u.email,
  u.plan_id,
  u.stripe_customer_id,
  u.stripe_subscription_id,
  cw.base_credits,
  cw.boost_credits,
  cw.balance_credits,
  COUNT(cl.id) AS remaining_ledger_entries
FROM auth_user u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
LEFT JOIN credit_ledger cl ON cl.user_id = u.id
WHERE u.email = 'codyshanemitchell@gmail.com'
GROUP BY u.id, u.email, u.plan_id, u.stripe_customer_id, u.stripe_subscription_id,
         cw.base_credits, cw.boost_credits, cw.balance_credits;
*/

-- Expected result after reset:
-- plan_id: trial
-- all credits: 0
-- stripe fields: NULL
-- ledger entries: 0
