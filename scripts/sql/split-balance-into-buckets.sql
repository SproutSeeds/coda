-- Split existing balance_credits into base_credits and boost_credits
-- This is for migrating from the old single-balance system to the new bucket system
--
-- Logic:
-- - base_credits = MIN(balance_credits, plan_cap)
-- - boost_credits = balance_credits - base_credits
--
-- Example:
-- - Pro user with 3000 balance_credits → 1200 base + 1800 boost
-- - Trial user with 100 balance_credits → 100 base + 0 boost
-- - Basic user with 500 balance_credits → 0 base + 500 boost (all purchased)

-- Step 1: Preview the split
WITH plan_caps AS (
  SELECT
    u.id,
    CASE
      WHEN u.plan_id = 'pro_20' THEN 1200
      WHEN u.plan_id = 'trial' THEN 150
      WHEN u.plan_id = 'basic_10' THEN 0
      ELSE 0
    END AS cap
  FROM auth_user u
)
SELECT
  u.email,
  u.plan_id,
  cw.balance_credits AS current_balance,
  LEAST(cw.balance_credits, pc.cap) AS will_be_base,
  GREATEST(cw.balance_credits - LEAST(cw.balance_credits, pc.cap), 0) AS will_be_boost,
  (LEAST(cw.balance_credits, pc.cap) + GREATEST(cw.balance_credits - LEAST(cw.balance_credits, pc.cap), 0)) AS verify_total
FROM auth_user u
JOIN credit_wallet cw ON cw.user_id = u.id
JOIN plan_caps pc ON pc.id = u.id
WHERE cw.balance_credits > 0
ORDER BY u.plan_id, u.email;

-- Step 2: Uncomment to execute the split
-- WARNING: This will modify base_credits and boost_credits based on balance_credits

/*
WITH plan_caps AS (
  SELECT
    u.id,
    CASE
      WHEN u.plan_id = 'pro_20' THEN 1200
      WHEN u.plan_id = 'trial' THEN 150
      WHEN u.plan_id = 'basic_10' THEN 0
      ELSE 0
    END AS cap
  FROM auth_user u
)
UPDATE credit_wallet cw
SET
  base_credits = LEAST(cw.balance_credits, pc.cap),
  boost_credits = GREATEST(cw.balance_credits - LEAST(cw.balance_credits, pc.cap), 0),
  updated_at = NOW()
FROM plan_caps pc
WHERE pc.id = cw.user_id;
*/

-- Step 3: Verify the split worked correctly
-- All users should have: balance_credits = base_credits + boost_credits
/*
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE balance_credits = base_credits + boost_credits) AS correct_split,
  COUNT(*) FILTER (WHERE balance_credits != base_credits + boost_credits) AS incorrect_split
FROM credit_wallet;
*/
