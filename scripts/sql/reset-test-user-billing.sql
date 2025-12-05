-- Reset billing/subscription state and mana balances for a test user.
-- Replace :user_id with the target auth_user.id

BEGIN;

-- Clear subscription and plan flags
UPDATE auth_user
SET
  plan_id = NULL,
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL,
  subscription_period_end = NULL
WHERE id = ':user_id';

-- Reset mana wallet
UPDATE wallets
SET
  mana_balance = 0,
  booster_balance = 0,
  last_core_grant_at = NULL
WHERE user_id = ':user_id';

-- Reset progression / channeling
UPDATE progression
SET
  is_channeling = FALSE,
  channeling_expires_at = NULL
WHERE user_id = ':user_id';

COMMIT;
