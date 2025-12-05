-- Create a test user for testing credit and plan functionality
-- This creates a Pro user with mixed base/boost credits
-- Safe to run multiple times (uses ON CONFLICT)

-- Step 1: Create the test user
BEGIN;

INSERT INTO auth_user (id, email, plan_id)
VALUES ('test-user-123', 'test@example.com', 'pro_20')
ON CONFLICT (email) DO UPDATE SET plan_id = 'pro_20';

INSERT INTO credit_wallet (user_id, base_credits, boost_credits, balance_credits, created_at, updated_at)
VALUES ('test-user-123', 500, 3000, 3500, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE
SET base_credits = 500,
    boost_credits = 3000,
    balance_credits = 3500,
    updated_at = NOW();

COMMIT;

-- Step 2: Verify the test user was created
SELECT
  'Test user created successfully!' AS status,
  u.id,
  u.email,
  u.plan_id,
  cw.base_credits,
  cw.boost_credits,
  cw.balance_credits,
  (cw.base_credits + cw.boost_credits) AS calculated_total
FROM auth_user u
JOIN credit_wallet cw ON cw.user_id = u.id
WHERE u.email = 'test@example.com';

-- Additional test users (uncomment if needed)

-- Trial user with low credits
/*
INSERT INTO auth_user (id, email, plan_id)
VALUES ('test-trial-456', 'trial@example.com', 'trial')
ON CONFLICT (email) DO UPDATE SET plan_id = 'trial';

INSERT INTO credit_wallet (user_id, base_credits, boost_credits, balance_credits)
VALUES ('test-trial-456', 100, 0, 100)
ON CONFLICT (user_id) DO UPDATE
SET base_credits = 100, boost_credits = 0, balance_credits = 100;
*/

-- Basic user with only purchased credits
/*
INSERT INTO auth_user (id, email, plan_id)
VALUES ('test-basic-789', 'basic@example.com', 'basic_10')
ON CONFLICT (email) DO UPDATE SET plan_id = 'basic_10';

INSERT INTO credit_wallet (user_id, base_credits, boost_credits, balance_credits)
VALUES ('test-basic-789', 0, 500, 500)
ON CONFLICT (user_id) DO UPDATE
SET base_credits = 0, boost_credits = 500, balance_credits = 500;
*/
