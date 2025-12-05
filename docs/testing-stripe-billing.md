# Testing Stripe Billing Integration

This guide covers how to test the Stripe billing integration, credit reset logic, and mana economy in your local development environment.

---

## Quick Start

### 1. Run Automated Tests First

```bash
# Run all unit tests
pnpm test -- --run

# Run specific test suites
pnpm test -- tests/unit/stripe-webhook-handler.test.ts --run
pnpm test -- tests/unit/wallet.test.ts --run
pnpm test -- tests/unit/ledger.test.ts --run

# Run with coverage report
pnpm test -- --coverage --run
```

**Expected Result:** All 148 tests should pass.

---

## Manual Testing Guide

### Prerequisites

1. **Stripe Test Mode Credentials**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/test/dashboard)
   - Get your test mode secret key
   - Add to `.env.local`:
     ```env
     STRIPE_SECRET_KEY=sk_test_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
     ```

2. **Install Stripe CLI**
   ```bash
   brew install stripe/stripe-cli/stripe
   stripe login
   ```

3. **Set Up ngrok (Alternative to Stripe CLI webhook forwarding)**
   ```bash
   brew install ngrok
   # Or download from https://ngrok.com/download
   ```

---

## Testing Scenarios

### Scenario 1: Monthly Credit Reset (invoice.paid webhook)

**Goal:** Verify that base credits reset to plan amount each billing cycle while boost credits remain untouched.

#### Using Stripe CLI (Recommended)

```bash
# Terminal 1: Start your dev server
pnpm dev

# Terminal 2: Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger a test invoice.paid event
stripe trigger invoice.payment_succeeded
```

#### Using ngrok + Stripe Dashboard

```bash
# Terminal 1: Start your dev server
pnpm dev

# Terminal 2: Start ngrok tunnel
ngrok http 3000

# Copy the ngrok URL (e.g., https://abc123.ngrok-free.app)
# Go to Stripe Dashboard > Developers > Webhooks
# Add endpoint: https://abc123.ngrok-free.app/api/stripe/webhook
# Select events: invoice.paid, customer.subscription.deleted, checkout.session.completed
```

#### Manual Verification Steps

1. **Create a Pro subscription test user:**
   ```sql
   -- In your database, create/update a test user
   UPDATE users
   SET
     plan_id = 'pro_20',
     stripe_subscription_id = 'sub_test_123',
     current_period_start = NOW(),
     current_period_end = NOW() + INTERVAL '1 month'
   WHERE email = 'test@example.com';
   ```

2. **Check initial wallet state:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```
   Example result: `base_credits: 800, boost_credits: 5000`

3. **Trigger invoice.paid webhook:**
   ```bash
   stripe trigger invoice.payment_succeeded
   ```

4. **Verify credits were reset:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```
   **Expected:** `base_credits: 1200` (Pro plan amount), `boost_credits: 5000` (unchanged)

5. **Check ledger entry was created:**
   ```sql
   SELECT * FROM credit_ledger
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   **Expected:** Entry with `type = 'monthly_included'`

---

### Scenario 2: Credit Consumption Order (Base → Boost)

**Goal:** Verify that AI operations consume base credits first, then boost credits.

#### Test Setup

1. **Set wallet to known state:**
   ```sql
   UPDATE credit_wallet
   SET base_credits = 100, boost_credits = 500
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```

2. **Perform AI operation that costs 150 credits** (e.g., generate vision analysis)
   - Go to your app's AI feature
   - Trigger an operation

3. **Verify consumption order:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```
   **Expected:** `base_credits: 0` (consumed all 100), `boost_credits: 450` (consumed 50)

4. **Check ledger shows the deduction:**
   ```sql
   SELECT amount, balance_after, type
   FROM credit_ledger
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   **Expected:** `amount: -150, type: 'ai_usage'`

---

### Scenario 3: Subscription Checkout (checkout.session.completed)

**Goal:** Verify that upgrading to Pro grants immediate credits.

#### Test Steps

1. **Start with Basic user:**
   ```sql
   UPDATE users
   SET plan_id = 'basic_10'
   WHERE email = 'test@example.com';

   UPDATE credit_wallet
   SET base_credits = 0, boost_credits = 0
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```

2. **Go through checkout flow:**
   - Navigate to `/pricing` or `/upgrade`
   - Click "Upgrade to Pro"
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC

3. **Verify immediate credit grant:**
   ```sql
   SELECT base_credits, boost_credits, plan_id
   FROM credit_wallet cw
   JOIN users u ON cw.user_id = u.id
   WHERE u.email = 'test@example.com';
   ```
   **Expected:** `base_credits: 1200` (Pro plan), `plan_id: 'pro_20'`

4. **Check ledger shows plan activation:**
   ```sql
   SELECT type, amount, stripe_reference
   FROM credit_ledger
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
   AND type = 'plan_activation';
   ```

---

### Scenario 4: Subscription Downgrade (customer.subscription.deleted)

**Goal:** Verify downgrade to Basic preserves boost credits but zeros base credits.

#### Test Steps

1. **Set up Pro user with mixed credits:**
   ```sql
   UPDATE users
   SET plan_id = 'pro_20', stripe_subscription_id = 'sub_test_downgrade'
   WHERE email = 'test@example.com';

   UPDATE credit_wallet
   SET base_credits = 800, boost_credits = 3000
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```

2. **Trigger subscription cancellation webhook:**
   ```bash
   stripe trigger customer.subscription.deleted
   ```

3. **Verify downgrade:**
   ```sql
   SELECT u.plan_id, cw.base_credits, cw.boost_credits
   FROM users u
   JOIN credit_wallet cw ON cw.user_id = u.id
   WHERE u.email = 'test@example.com';
   ```
   **Expected:** `plan_id: 'basic_10'`, `base_credits: 0`, `boost_credits: 3000` (preserved!)

---

### Scenario 5: Credit Top-Up (One-Time Purchase)

**Goal:** Verify purchasing mana potions adds to boost credits only.

#### Test Steps

1. **Check initial state:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```
   Example: `base_credits: 500, boost_credits: 1000`

2. **Purchase $25 mana potion (2000 credits):**
   - Go to `/credits`
   - Click "Buy 2000 Credits ($25)"
   - Use test card: `4242 4242 4242 4242`

3. **Verify boost credits increased:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```
   **Expected:** `base_credits: 500` (unchanged), `boost_credits: 3000` (+2000)

4. **Check ledger entry:**
   ```sql
   SELECT type, amount, stripe_reference
   FROM credit_ledger
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
   AND type = 'topup'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

---

### Scenario 6: Idempotency (Replaying Webhooks)

**Goal:** Verify that replaying the same webhook doesn't double-credit.

#### Test Steps

1. **Note current credits:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```

2. **Trigger invoice.paid webhook twice with same event ID:**
   ```bash
   # First trigger
   stripe trigger invoice.payment_succeeded

   # Wait 5 seconds, then replay the SAME event
   # (In Stripe Dashboard > Developers > Events, find the event and click "Resend")
   ```

3. **Verify credits only updated once:**
   ```sql
   SELECT base_credits, boost_credits
   FROM credit_wallet
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
   ```
   **Expected:** Credits match the amount after first webhook (no double-crediting)

4. **Check ledger shows only one entry for that invoice:**
   ```sql
   SELECT COUNT(*), stripe_reference
   FROM credit_ledger
   WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
   AND type = 'monthly_included'
   GROUP BY stripe_reference
   HAVING COUNT(*) > 1;
   ```
   **Expected:** Empty result (no duplicates)

---

## Debugging Webhook Issues

### Check Webhook Logs

```bash
# Stripe CLI
stripe logs tail

# Or in Stripe Dashboard
# Developers > Events > Filter by webhook endpoint
```

### Common Issues

**1. Webhook signature verification fails:**
```bash
# Make sure STRIPE_WEBHOOK_SECRET matches your endpoint
stripe listen --print-secret
# Copy the whsec_... value to .env.local
```

**2. Webhook not received:**
```bash
# Verify ngrok is forwarding correctly
curl https://your-ngrok-url.ngrok-free.app/api/stripe/webhook
# Should return 405 Method Not Allowed (GET not supported, only POST)
```

**3. Database connection issues:**
```bash
# Test DATABASE_URL is correct
psql $DATABASE_URL -c "SELECT 1;"
```

---

## Quick Database Queries for QA

### Check user's current state:
```sql
SELECT
  u.email,
  u.plan_id,
  p.name AS plan_name,
  cw.base_credits,
  cw.boost_credits,
  (cw.base_credits + cw.boost_credits) AS total_credits,
  u.stripe_subscription_id,
  u.current_period_end
FROM users u
LEFT JOIN credit_wallet cw ON cw.user_id = u.id
LEFT JOIN plans p ON p.id = u.plan_id
WHERE u.email = 'test@example.com';
```

### View recent credit activity:
```sql
SELECT
  cl.created_at,
  cl.type,
  cl.amount,
  cl.balance_after,
  cl.description,
  cl.stripe_reference
FROM credit_ledger cl
WHERE cl.user_id = (SELECT id FROM users WHERE email = 'test@example.com')
ORDER BY cl.created_at DESC
LIMIT 20;
```

### Reset test user to clean state:
```sql
-- Reset to Basic plan with no credits
UPDATE users
SET
  plan_id = 'basic_10',
  stripe_subscription_id = NULL,
  stripe_customer_id = NULL,
  current_period_start = NULL,
  current_period_end = NULL
WHERE email = 'test@example.com';

UPDATE credit_wallet
SET base_credits = 0, boost_credits = 0
WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');

-- Or give Pro plan with test credits
UPDATE users
SET plan_id = 'pro_20'
WHERE email = 'test@example.com';

UPDATE credit_wallet
SET base_credits = 1200, boost_credits = 5000
WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
```

---

## Production Readiness Checklist

Before deploying to production:

- [ ] All unit tests passing (`pnpm test -- --run`)
- [ ] TypeScript compilation successful (`pnpm typecheck`)
- [ ] Webhook signature verification working in test mode
- [ ] Tested all 6 scenarios above in local dev
- [ ] Verified idempotency (webhook replay doesn't double-credit)
- [ ] Confirmed boost credits never reset on any operation
- [ ] Tested base-first consumption order
- [ ] Set up Stripe webhook endpoint in production
- [ ] Added production STRIPE_WEBHOOK_SECRET to Vercel env vars
- [ ] Monitored Stripe Dashboard > Events for successful webhook delivery
- [ ] Set up error monitoring/alerts for failed webhooks

---

## Next Steps

1. **Run the unit tests** to verify everything works:
   ```bash
   pnpm test -- --run
   ```

2. **Set up Stripe CLI** for webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. **Test each scenario above** systematically

4. **Check the logs** in your terminal and Stripe Dashboard to see webhook processing in real-time

5. **Use the database queries** to verify state changes after each operation

Need help with any specific scenario? Let me know!
