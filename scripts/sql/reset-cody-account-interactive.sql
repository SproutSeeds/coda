-- INTERACTIVE RESET: Cody's Account
-- Choose your starting experience after reset
-- Email: codyshanemitchell@gmail.com

-- ============================================================================
-- STEP 1: Full Reset (runs automatically)
-- ============================================================================

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

-- Remove plan assignment (user will choose on login)
UPDATE auth_user
SET plan_id = NULL,
    trial_started_at = NULL,
    trial_ends_at = NULL,
    current_period_start = NULL,
    current_period_end = NULL
WHERE email = 'codyshanemitchell@gmail.com';

COMMIT;

SELECT '✅ Account reset complete! Now choose your experience...' AS status;
SELECT '' AS blank_line;

-- ============================================================================
-- STEP 2: Choose Your Experience
-- ============================================================================

SELECT '📋 CHOOSE YOUR STARTING EXPERIENCE:' AS options;
SELECT '' AS blank_line;

SELECT '1️⃣  NEW USER - Clean slate (No plan assigned, 0 credits)' AS option_1;
SELECT '     User will see plan selection on next login' AS description_1;
SELECT '' AS blank_line;

SELECT '2️⃣  TRIAL USER - Start with trial (Trial plan, 150 credits)' AS option_2;
SELECT '     Experience the 7-day trial with AI enabled' AS description_2;
SELECT '' AS blank_line;

SELECT '3️⃣  PRO USER - Already subscribed (Pro plan, 1200 credits)' AS option_3;
SELECT '     Test as if you already upgraded to Pro' AS description_3;
SELECT '' AS blank_line;

SELECT '4️⃣  POWER USER - Pro + bonus mana (Pro, 1200 base + 5000 boost)' AS option_4;
SELECT '     Test with existing mana potion purchase' AS description_4;
SELECT '' AS blank_line;

-- ============================================================================
-- OPTION 1: NEW USER (No plan assigned)
-- ============================================================================
-- This option is ALREADY ACTIVE after reset!
-- The reset above set plan_id to NULL, so you'll see the plan selection page

-- No additional code needed for Option 1

-- ============================================================================
-- OPTION 2: TRIAL USER (Trial plan, 150 credits)
-- ============================================================================
-- Uncomment this block to choose Option 2

/*
UPDATE auth_user
SET plan_id = 'trial',
    trial_started_at = NOW(),
    trial_ends_at = NOW() + INTERVAL '7 days'
WHERE email = 'codyshanemitchell@gmail.com';

UPDATE credit_wallet
SET base_credits = 150,
    boost_credits = 0,
    balance_credits = 150,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com');

INSERT INTO credit_ledger (user_id, delta_credits, reason, ref_type, ref_id)
VALUES (
  (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'),
  150,
  'trial_activation',
  'system.trial',
  'manual-setup'
);

SELECT '✅ OPTION 2 ACTIVATED: Trial User Experience' AS result;
SELECT '   Plan: Trial' AS detail_1;
SELECT '   Credits: 150 base' AS detail_2;
SELECT '   Trial ends: 7 days from now' AS detail_3;
SELECT '   Next: Test AI features and trial expiry flow!' AS next_step;
*/

-- ============================================================================
-- OPTION 3: PRO USER (Pro plan, 1200 credits)
-- ============================================================================
-- Uncomment this block to choose Option 3

/*
UPDATE auth_user
SET plan_id = 'pro_20',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month'
WHERE email = 'codyshanemitchell@gmail.com';

UPDATE credit_wallet
SET base_credits = 1200,
    boost_credits = 0,
    balance_credits = 1200,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com');

INSERT INTO credit_ledger (user_id, delta_credits, reason, ref_type, ref_id)
VALUES (
  (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'),
  1200,
  'plan_activation',
  'system.manual_setup',
  'manual-pro-setup'
);

SELECT '✅ OPTION 3 ACTIVATED: Pro User Experience' AS result;
SELECT '   Plan: Pro' AS detail_1;
SELECT '   Credits: 1200 base' AS detail_2;
SELECT '   Next period: 1 month from now' AS detail_3;
SELECT '   Next: Test monthly credit reset and mana potion purchases!' AS next_step;
*/

-- ============================================================================
-- OPTION 4: POWER USER (Pro + 5000 boost credits)
-- ============================================================================
-- Uncomment this block to choose Option 4

/*
UPDATE auth_user
SET plan_id = 'pro_20',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month'
WHERE email = 'codyshanemitchell@gmail.com';

UPDATE credit_wallet
SET base_credits = 1200,
    boost_credits = 5000,
    balance_credits = 6200,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com');

INSERT INTO credit_ledger (user_id, delta_credits, reason, ref_type, ref_id)
VALUES
  ((SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'), 1200, 'plan_activation', 'system.manual_setup', 'manual-pro-setup'),
  ((SELECT id FROM auth_user WHERE email = 'codyshanemitchell@gmail.com'), 5000, 'topup', 'system.manual_setup', 'manual-potion-setup');

SELECT '✅ OPTION 4 ACTIVATED: Power User Experience' AS result;
SELECT '   Plan: Pro' AS detail_1;
SELECT '   Credits: 1200 base + 5000 boost = 6200 total' AS detail_2;
SELECT '   Next: Test credit consumption order (base → boost)!' AS next_step;
*/

-- ============================================================================
-- Verify Current State
-- ============================================================================

SELECT '' AS blank_line;
SELECT '📊 CURRENT STATE:' AS current_state;

SELECT
  u.email,
  u.plan_id AS plan,
  cw.base_credits AS base,
  cw.boost_credits AS boost,
  cw.balance_credits AS total,
  COUNT(cl.id) AS ledger_entries
FROM auth_user u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
LEFT JOIN credit_ledger cl ON cl.user_id = u.id
WHERE u.email = 'codyshanemitchell@gmail.com'
GROUP BY u.id, u.email, u.plan_id, cw.base_credits, cw.boost_credits, cw.balance_credits;
