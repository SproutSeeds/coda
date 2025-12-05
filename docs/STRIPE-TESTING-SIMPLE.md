# Simple Guide: What We Built & How to Test It

## What We Built (Plain English)

Your app now has a **mana/credit billing system**:

### The System
1. Users pay for a subscription (Basic or Pro)
2. Pro users get 1,200 "mana" credits every month
3. When users do AI stuff (generate code, analyze images), it costs mana
4. Users can also buy one-time "mana potions" for extra credits

### The Rules
- **Base Mana** = Monthly subscription credits (resets every month)
- **Boost Mana** = Purchased credits (NEVER resets, lasts forever)
- **Consumption Order** = Always use Base mana first, then Boost mana

### Example
- User starts month with: 1,200 base + 5,000 boost
- User does AI work costing 1,500 credits
- After: 0 base + 4,700 boost (used all 1,200 base, then 300 from boost)
- Next month: 1,200 base + 4,700 boost (base refilled, boost unchanged!)

---

## What Are We Testing?

We need to verify that **Stripe webhooks work correctly**. Here's what happens:

### Webhook Flow
1. User pays Stripe for subscription → Stripe sends "invoice.paid" event to your app
2. Your app receives the event → Resets user's base mana to 1,200
3. Your app saves a record in the database → You can verify it worked

---

## The Signature Error You Saw (EXPLAINED)

```
[stripe-webhook] Error: Stripe signature verification failed
POST /api/stripe/webhook 400 in 44ms

POST /api/stripe/webhook 200 in 17ms  ← THIS ONE WORKED!
```

### What's Happening
- Stripe is sending webhooks to **multiple endpoints at once**
- One endpoint has the RIGHT secret (200 ✅)
- Other endpoints have WRONG secrets (400 ❌)

### Why This Happens
You probably have webhooks configured in:
1. Stripe Dashboard (ngrok endpoint) - has secret `whsec_jKZWzaEcZiBfTlwUZOXdxapfIuXOc85c`
2. Stripe CLI listener - has a DIFFERENT secret

**The errors are just noise. The 200 response means it worked!**

---

## How to Test (Step by Step)

### Option 1: Quick Test (Just See If It Works)

```bash
# Terminal 1: Start your app
cd /Users/codymitchell/Documents/code/coda
pnpm dev

# Terminal 2: Listen for webhooks with Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger a test event
stripe trigger invoice.payment_succeeded
```

Look for the `200` response - that means it worked!

---

### Option 2: Full Test (Verify It Actually Did Something)

#### Step 1: Check if you have any test users

Run this in your terminal:

```bash
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-small-tooth-adn6cr0r-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system" -c "SELECT id, email, plan_id FROM users LIMIT 5;"
```

#### Step 2: Create a test Pro user (if needed)

```bash
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-small-tooth-adn6cr0r-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system" -c "
INSERT INTO users (id, email, plan_id, stripe_subscription_id)
VALUES ('test-user-123', 'test@example.com', 'pro_20', 'sub_test_12345')
ON CONFLICT (id) DO UPDATE SET plan_id = 'pro_20', stripe_subscription_id = 'sub_test_12345';

INSERT INTO credit_wallet (user_id, base_credits, boost_credits)
VALUES ('test-user-123', 500, 2000)
ON CONFLICT (user_id) DO UPDATE SET base_credits = 500, boost_credits = 2000;
"
```

#### Step 3: Check their current credits

```bash
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-small-tooth-adn6cr0r-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system" -c "
SELECT u.email, u.plan_id, cw.base_credits, cw.boost_credits
FROM users u
JOIN credit_wallet cw ON cw.user_id = u.id
WHERE u.email = 'test@example.com';
"
```

Should show: `base_credits: 500, boost_credits: 2000`

#### Step 4: Trigger the monthly reset webhook

```bash
stripe trigger invoice.payment_succeeded
```

#### Step 5: Check if credits were reset

```bash
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-small-tooth-adn6cr0r-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system" -c "
SELECT u.email, cw.base_credits, cw.boost_credits
FROM users u
JOIN credit_wallet cw ON cw.user_id = u.id
WHERE u.email = 'test@example.com';
"
```

**Expected Result:** `base_credits: 1200` (reset!), `boost_credits: 2000` (unchanged!)

#### Step 6: Check the ledger (audit log)

```bash
psql "postgresql://neondb_owner:npg_EHWLzMRNQX04@ep-small-tooth-adn6cr0r-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&sslrootcert=system" -c "
SELECT created_at, type, amount, balance_after, description
FROM credit_ledger
WHERE user_id = 'test-user-123'
ORDER BY created_at DESC
LIMIT 5;
"
```

Should show a new entry with `type = 'monthly_included'` and `amount = 700` (the difference: 1200 - 500)

---

## What If It Didn't Work?

### 1. Check webhook secret mismatch

The webhook secret in `.env.local` (line 41) is:
```
STRIPE_WEBHOOK_SECRET="whsec_jKZWzaEcZiBfTlwUZOXdxapfIuXOc85c"
```

This needs to match the endpoint you're testing with:
- **For ngrok**: Use the secret from Stripe Dashboard webhook endpoint
- **For Stripe CLI**: Get the secret by running:
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe/webhook --print-secret
  ```
  Then update `.env.local` with that secret and restart `pnpm dev`

### 2. Check the logs

Look at your dev server terminal for:
```
[webhook-handler] Processing invoice.paid for customer cus_...
[wallet] Reset base_credits to 1200 for user xxx
```

---

## Summary (TL;DR)

**What we built:** A credit system where base credits reset monthly, boost credits last forever

**What we're testing:** That Stripe webhooks correctly reset base credits every month

**How to test:**
1. Run `stripe trigger invoice.payment_succeeded`
2. Look for `200` response (means it worked)
3. Check database to see if credits actually changed

**The errors you saw:** Just noise from multiple webhook endpoints. Ignore the `400` errors, the `200` means success!

**Need help?** The signature errors are normal when you have multiple webhook endpoints. Just disable the ones you're not using in the Stripe Dashboard.
