# SQL Helper Scripts for Credit Management

These scripts help you manage user credits and plans in your Coda database.

## Quick Reference

| Script | Purpose | Safety |
|--------|---------|--------|
| `reset-cody-account.sql` | **MAIN RESET** - Reset Cody's account to free tier | ⚠️ Deletes credit history |
| `full-account-reset.sql` | Generic reset template for any user | ⚠️ Deletes credit history |
| `create-test-user.sql` | Create test user for testing | ✅ Safe (creates test@example.com) |
| `split-balance-into-buckets.sql` | One-time migration script | ⚠️ Preview first |

## Understanding the Credit System

### Three Credit Fields

Your `credit_wallet` table has three fields:

- **`balance_credits`**: Total credits (legacy field, kept for compatibility)
- **`base_credits`**: Monthly subscription allowance (resets every billing cycle)
- **`boost_credits`**: Purchased credits (NEVER resets, lasts forever)

**Rule**: `balance_credits = base_credits + boost_credits`

### Plan Credit Limits

| Plan ID | Monthly Base Credits |
|---------|---------------------|
| `trial` | 150 |
| `basic_10` | 0 |
| `pro_20` | 1200 |

## How to Use These Scripts

### 1. Connect to Your Database

```bash
# Development database
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-small-tooth-adn6cr0r-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system"

# Production database (be VERY careful!)
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-green-glade-adgerwal-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system"
```

### 2. Run a Script

```bash
# Option A: Run from file
psql "YOUR_DATABASE_URL" -f scripts/sql/reset-user-credits.sql

# Option B: Copy/paste into psql session
psql "YOUR_DATABASE_URL"
\i scripts/sql/reset-user-credits.sql
```

## Common Tasks

### Task: Full Account Reset (Main Use Case)

**Use case**: Reset account to free tier with zero credits

```bash
# Option 1: Reset Cody's account specifically
psql "YOUR_DATABASE_URL" -f scripts/sql/reset-cody-account.sql

# Option 2: Reset any user (edit file first, replace USER_EMAIL_HERE)
psql "YOUR_DATABASE_URL" -f scripts/sql/full-account-reset.sql
```

**What it does**:
- Sets plan to `trial` (Wanderer free path)
- Zeros ALL credits (base + boost + balance)
- **Deletes all credit history** (ledger entries)
- Preserves all other user data (email, name, Stripe IDs, etc.)

### Task: Migrate from Old Balance System

**Use case**: One-time migration when deploying the bucket system

```bash
# 1. Run preview query first to see what will happen
psql "YOUR_DATABASE_URL" -f scripts/sql/split-balance-into-buckets.sql

# 2. If it looks good, edit the file and uncomment the UPDATE block
# 3. Run it again to execute
```

**What it does**:
- Splits `balance_credits` into `base_credits` + `boost_credits`
- Logic: Base = MIN(balance, plan_cap), Boost = remainder
- Example: Pro user with 3000 total → 1200 base + 1800 boost

### Task: Create a Test User

**Quick script** (not in a file, just copy/paste):

```sql
-- Create Pro test user with mixed credits
BEGIN;

INSERT INTO auth_user (id, email, plan_id)
VALUES ('test-user-123', 'test@example.com', 'pro_20')
ON CONFLICT (email) DO UPDATE SET plan_id = 'pro_20';

INSERT INTO credit_wallet (user_id, base_credits, boost_credits, balance_credits)
VALUES ('test-user-123', 500, 3000, 3500)
ON CONFLICT (user_id) DO UPDATE
SET base_credits = 500, boost_credits = 3000, balance_credits = 3500;

COMMIT;

-- Verify
SELECT u.email, u.plan_id, cw.base_credits, cw.boost_credits
FROM auth_user u
JOIN credit_wallet cw ON cw.user_id = u.id
WHERE u.email = 'test@example.com';
```

## Safety Tips

### Before Running ANY Script

1. **Always preview first** - Most scripts show you what will change before executing
2. **Use transactions** - Wrap in `BEGIN;` and `COMMIT;` so you can `ROLLBACK;` if needed
3. **Test on dev database first** - Never test on production!
4. **Backup important data** - Especially before bulk operations

### The Scripts are Commented Out

Most destructive operations are commented out with `/* */`. You must:
1. Read the preview query output
2. Manually uncomment the UPDATE/DELETE block
3. Re-run the script

This prevents accidental execution.

## Troubleshooting

### "relation does not exist" error

Your database might use different table names. Check:

```sql
-- List all tables
\dt

-- If tables are named differently, edit the scripts to match
```

### balance_credits doesn't match base + boost

Run this to find mismatches:

```sql
SELECT
  user_id,
  balance_credits,
  base_credits,
  boost_credits,
  balance_credits - (base_credits + boost_credits) AS difference
FROM credit_wallet
WHERE balance_credits != base_credits + boost_credits;
```

Fix with:

```sql
UPDATE credit_wallet
SET balance_credits = base_credits + boost_credits
WHERE balance_credits != base_credits + boost_credits;
```

## Advanced: Analyzing Credit Distribution

```sql
-- See credit distribution by plan
SELECT
  u.plan_id,
  COUNT(*) AS users,
  AVG(cw.base_credits) AS avg_base,
  AVG(cw.boost_credits) AS avg_boost,
  SUM(cw.base_credits) AS total_base,
  SUM(cw.boost_credits) AS total_boost
FROM auth_user u
JOIN credit_wallet cw ON cw.user_id = u.id
GROUP BY u.plan_id
ORDER BY u.plan_id;

-- Find users with unusual credit amounts
SELECT
  u.email,
  u.plan_id,
  cw.base_credits,
  cw.boost_credits,
  CASE
    WHEN u.plan_id = 'pro_20' AND cw.base_credits > 1200 THEN 'OVER_LIMIT'
    WHEN u.plan_id = 'trial' AND cw.base_credits > 150 THEN 'OVER_LIMIT'
    WHEN u.plan_id = 'basic_10' AND cw.base_credits > 0 THEN 'SHOULD_BE_ZERO'
    ELSE 'OK'
  END AS status
FROM auth_user u
JOIN credit_wallet cw ON cw.user_id = u.id
WHERE
  (u.plan_id = 'pro_20' AND cw.base_credits > 1200) OR
  (u.plan_id = 'trial' AND cw.base_credits > 150) OR
  (u.plan_id = 'basic_10' AND cw.base_credits > 0);
```

## Need Help?

These scripts are templates. You'll need to:
- Replace placeholder values (`USER_EMAIL_HERE`, `NEW_PLAN_ID`)
- Uncomment transaction blocks to execute
- Adjust table/column names if your schema differs

Always test on development database first!
