<objective>
Implement monthly base mana (credit) reset logic for Stripe billing cycles, add comprehensive unit tests for all webhook handlers, and update downgrade scheduling to clear billing calendar selections with user confirmation.

This work completes the Stripe integration billing automation and ensures the wallet system correctly manages base mana replenishment, boost mana persistence, and scheduled downgrades.
</objective>

<context>
You're working on the Coda monetization system which uses a fantasy mana theme for credits.

**Wallet System Design:**
- Users have TWO mana buckets: `base_credits` (monthly replenishment) and `boost_credits` (purchased, never reset)
- Base mana is ALWAYS consumed first, then boost mana
- On monthly billing cycle (`invoice.paid` webhook), base mana resets to plan's `credits_per_month`
- Boost mana persists indefinitely and is only consumed when base mana is exhausted

**Current State:**
- Stripe webhook handler exists at `app/api/stripe/webhook/route.ts` and receives events via ngrok during local dev
- Checkout flows work for subscriptions and one-time top-ups
- Wallet schema exists with `base_credits` and `boost_credits` columns
- Downgrade scheduling UI exists but needs webhook support
- Monthly credit reset logic is NOT yet implemented (this is your primary task)

**Tech Stack:**
- Next.js 15 App Router with Server Actions
- Drizzle ORM + PostgreSQL (Neon dev, Vercel prod)
- Vitest for unit tests
- Stripe SDK for webhook verification

Read CLAUDE.md for project conventions, especially around testing and server actions.

@app/api/stripe/webhook/route.ts
@lib/monetization/wallet.ts
@lib/monetization/ledger.ts
@lib/db/schema/monetization.ts
@lib/stripe/
@app/dashboard/billing/page.tsx
</context>

<requirements>
1. **Monthly Credit Reset Logic**
   - Implement handler for `invoice.paid` webhook event
   - Reset user's `base_credits` to their plan's `credits_per_month` value
   - NEVER touch `boost_credits` (purchased mana persists)
   - Record ledger entry with type `MONTHLY_REFRESH` or similar
   - Handle edge cases: user downgraded mid-cycle, plan changed, subscription paused
   - Be idempotent (safe to replay the same webhook event)

2. **Credit Consumption Order (verify/enforce)**
   - Ensure existing debit logic in `lib/monetization/wallet.ts` consumes base_credits FIRST
   - Only deduct from boost_credits when base_credits hits zero
   - Update any AI operation wrappers to respect this order
   - Add clear comments explaining the consumption priority

3. **Downgrade Scheduling + Billing Calendar Integration**
   - When user clicks "Schedule Downgrade at Next Renewal":
     - Show confirmation dialog: "This will clear your billing calendar selections. Continue?"
     - If confirmed, clear all billing calendar checkboxes (set all months to inactive)
     - Record the scheduled downgrade in user record
   - Implement `customer.subscription.deleted` webhook handler to execute the downgrade:
     - Transition user to Basic plan
     - Reset base_credits to Basic plan's credits_per_month (currently 0)
     - Keep boost_credits intact
     - Clear scheduled downgrade flag
     - Record analytics event

4. **Comprehensive Unit Tests**
   Write Vitest unit tests covering:

   **Webhook Handlers** (`tests/unit/stripe-webhooks.test.ts`):
   - `checkout.session.completed` - new subscription grants immediate Pro credits
   - `invoice.paid` - monthly refresh resets base_credits, preserves boost_credits
   - `invoice.paid` - handles plan changes mid-cycle correctly
   - `customer.subscription.deleted` - executes scheduled downgrade to Basic
   - Webhook signature verification (valid vs invalid signatures)
   - Idempotency (replaying same event doesn't double-credit)

   **Wallet Operations** (`tests/unit/wallet.test.ts`):
   - Credit deduction consumes base_credits first, then boost_credits
   - Monthly refresh resets only base_credits
   - Top-up adds to boost_credits only
   - Insufficient credits scenario (both buckets exhausted)

   **Ledger Operations** (`tests/unit/ledger.test.ts`):
   - All transaction types create ledger entries (MONTHLY_REFRESH, PURCHASE, DEBIT, etc.)
   - Ledger history accurately reflects wallet state changes
   - Query helpers return correct balance calculations

5. **Logging & Observability**
   - Add structured logs for all credit resets, downgrades, and webhook processing
   - Include user_id, event_type, old/new balances, timestamp
   - Use existing analytics util from `lib/utils/analytics.ts`
</requirements>

<implementation>
**DO:**
- Use existing Drizzle schema types from `lib/db/schema/monetization.ts`
- Follow the server action pattern (Zod validation, error handling, return `{ success, data?, error? }`)
- Make webhook handlers idempotent using Stripe event ID or timestamp checks
- Add wallet helper functions to `lib/monetization/wallet.ts` (don't scatter logic)
- Use `@vercel/postgres` transaction API for atomic wallet + ledger updates
- Reference existing webhook verification from `app/api/stripe/webhook/route.ts`

**WHY these constraints matter:**
- Idempotency prevents double-crediting if Stripe retries webhook delivery
- Atomic transactions ensure wallet and ledger stay in sync (critical for audit trail)
- Base-first consumption ensures users get full value from their subscription before using purchased mana
- Preserving boost_credits on downgrades maintains trust (users paid for those credits)

**DON'T:**
- Touch the Fantasy Mana Theme tasks (Phase 1-4) - that's separate work
- Modify checkout flows unless directly related to credit reset
- Add new database migrations (work with existing schema)
- Skip test coverage for edge cases (plan changes, subscription pauses, replayed events)

**Edge Cases to Handle:**
- User upgrades mid-month (should they get full new plan credits or prorated?)
- User downgrades before next billing cycle (scheduled downgrade vs immediate)
- Subscription paused/resumed (Stripe `subscription.paused` event)
- Webhook arrives out of order (old invoice.paid after newer one)
</implementation>

<output>
Create or modify these files:

**Implementation:**
- `lib/monetization/wallet.ts` - Add `resetBaseCredits()`, ensure `deductCredits()` prioritizes base_credits
- `lib/monetization/ledger.ts` - Add ledger entry helpers for MONTHLY_REFRESH type
- `app/api/stripe/webhook/route.ts` - Add handlers for `invoice.paid` and `customer.subscription.deleted`
- `app/dashboard/billing/actions.ts` - Update `scheduleDowngrade()` to clear billing calendar with confirmation

**Tests:**
- `tests/unit/stripe-webhooks.test.ts` - Comprehensive webhook handler tests
- `tests/unit/wallet.test.ts` - Wallet operation tests (base-first consumption, reset logic)
- `tests/unit/ledger.test.ts` - Ledger entry and query tests

**Types/Schema (if needed):**
- Update `lib/db/schema/monetization.ts` if new ledger transaction types needed
- Update TypeScript types in `lib/stripe/types.ts` if missing Stripe event shapes
</output>

<verification>
Before declaring complete, verify:

1. **Run Tests:**
   ```bash
   pnpm test -- tests/unit/stripe-webhooks.test.ts --run
   pnpm test -- tests/unit/wallet.test.ts --run
   pnpm test -- tests/unit/ledger.test.ts --run
   ```
   All tests must pass.

2. **Type Check:**
   ```bash
   pnpm typecheck
   ```
   No TypeScript errors.

3. **Test Coverage Checklist:**
   - [ ] invoice.paid resets base_credits to plan amount
   - [ ] invoice.paid preserves boost_credits
   - [ ] invoice.paid is idempotent (replay doesn't double-credit)
   - [ ] customer.subscription.deleted downgrades to Basic
   - [ ] customer.subscription.deleted preserves boost_credits
   - [ ] deductCredits() consumes base_credits first
   - [ ] deductCredits() falls back to boost_credits when base is empty
   - [ ] Ledger entries created for all wallet mutations

4. **Manual QA Scenarios (document in test file comments):**
   - Pro user hits monthly renewal → base mana resets to 1,200
   - Pro user with 500 base + 3,000 boost casts 600 mana spell → ends with 0 base + 2,900 boost
   - User schedules downgrade → billing calendar cleared, confirmed in UI
   - Downgrade executes on subscription end → user becomes Basic with 0 base + preserved boost

5. **Code Review Checklist:**
   - [ ] Wallet mutations wrapped in transactions
   - [ ] All credit changes create ledger entries
   - [ ] Webhook handlers log structured events
   - [ ] Error cases return actionable messages
   - [ ] No hardcoded plan IDs (use schema constants)
</verification>

<success_criteria>
1. All unit tests pass with >90% coverage for wallet/ledger/webhook modules
2. `invoice.paid` webhook correctly resets base_credits monthly while preserving boost_credits
3. `customer.subscription.deleted` webhook executes scheduled downgrades to Basic plan
4. Credit consumption always prioritizes base_credits before boost_credits
5. Downgrade scheduling clears billing calendar with user confirmation
6. All wallet mutations are atomic (transaction-wrapped) and logged
7. Webhook handlers are idempotent and handle edge cases gracefully
8. TypeScript compilation succeeds with no errors
9. Documentation in test files explains the mana economy behavior
</success_criteria>

<research>
If you need to understand the existing implementation before making changes:
- Read the current webhook handler structure in `app/api/stripe/webhook/route.ts`
- Check how wallets are currently updated in `lib/monetization/wallet.ts`
- Review ledger entry patterns in `lib/monetization/ledger.ts`
- Look at existing test patterns in `tests/unit/` for consistency
</research>

<notes>
**Priority Order:**
1. Implement monthly credit reset logic (highest value)
2. Add comprehensive unit tests (quality gate)
3. Update downgrade + billing calendar integration (UX polish)

**Testing Philosophy:**
- Unit tests should mock database calls and focus on business logic
- Use Vitest's `vi.mock()` to stub Drizzle queries
- Test happy path AND edge cases (plan changes, replayed webhooks, etc.)
- Include descriptive test names that explain the scenario

**Deployment Note:**
This code will be tested locally using ngrok to receive Stripe webhooks. Ensure all webhook handlers verify signatures before processing events.
</notes>
