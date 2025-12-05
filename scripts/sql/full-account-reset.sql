-- FULL ACCOUNT RESET
-- Resets user to the Wanderer (free trial) plan, zeros credits, clears ledger history
-- Usage: Replace 'USER_EMAIL_HERE' with the actual user email

-- DANGER: This clears all credit history and resets to free tier!

-- Step 1: Preview what will be deleted/reset
SELECT '=== CURRENT STATE ===' AS section;

SELECT
  u.email,
  u.plan_id AS current_plan,
  cw.base_credits,
  cw.boost_credits,
  cw.balance_credits,
  COUNT(cl.id) AS ledger_entries_count
FROM auth_user u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
LEFT JOIN credit_ledger cl ON cl.user_id = u.id
WHERE u.email = 'USER_EMAIL_HERE'
GROUP BY u.id, u.email, u.plan_id, cw.base_credits, cw.boost_credits, cw.balance_credits;

SELECT '=== LEDGER ENTRIES TO BE DELETED ===' AS section;

SELECT
  created_at,
  reason AS type,
  delta_credits AS amount,
  ref_type,
  ref_id
FROM credit_ledger
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'USER_EMAIL_HERE')
ORDER BY created_at DESC;

-- Step 2: Execute the reset (uncomment to run)
-- WARNING: This deletes ledger history permanently!

/*
BEGIN;

-- Delete all ledger entries for this user
DELETE FROM credit_ledger
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'USER_EMAIL_HERE');

-- Reset credits to zero
UPDATE credit_wallet
SET base_credits = 0,
    boost_credits = 0,
    balance_credits = 0,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'USER_EMAIL_HERE');

-- Reset user to Wanderer plan (keeps Stripe data for history/reference)
UPDATE auth_user
SET plan_id = 'trial'
WHERE email = 'USER_EMAIL_HERE';

COMMIT;
*/

-- Step 3: Verify the reset
/*
SELECT
  '=== AFTER RESET ===' AS section,
  u.email,
  u.plan_id,
  cw.base_credits,
  cw.boost_credits,
  cw.balance_credits,
  COUNT(cl.id) AS remaining_ledger_entries
FROM auth_user u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
LEFT JOIN credit_ledger cl ON cl.user_id = u.id
WHERE u.email = 'USER_EMAIL_HERE'
GROUP BY u.id, u.email, u.plan_id, cw.base_credits, cw.boost_credits, cw.balance_credits;
*/
