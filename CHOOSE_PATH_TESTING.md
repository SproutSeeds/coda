# Choose Path Page - Testing Guide

## Overview
This document provides instructions for testing the new fantasy-themed `/choose-path` page that allows users without a plan to select their adventurer rank.

## What Was Implemented

### 1. New Files Created
- **`/app/choose-path/page.tsx`** - Fantasy-themed plan selection page with three rank cards (Wanderer, Apprentice, Mage)
- **`/app/choose-path/actions.ts`** - Server action for selecting the free Wanderer plan

### 2. Modified Files
- **`/middleware.ts`** - Enhanced to redirect users with `plan_id = NULL` to `/choose-path`
- **`/lib/plans/constants.ts`** - Added `PLAN_FANTASY_NAMES` constant mapping plan IDs to fantasy ranks
- **`/lib/plans/service.ts`** - Fixed TypeScript type issue in `getUserPlan` function

### 3. Features Implemented

#### Page Design
- Fantasy RPG-themed UI with gradient background
- Hero section: "Choose Your Path in the Realm"
- Three rank cards with consistent fantasy language
- Mobile-responsive (cards stack on mobile, grid on desktop)
- Mage card highlighted with "Most Popular" badge

#### Three Adventurer Ranks

**Wanderer (Free Trial)**
- Price: Free forever
- Mana: 150 mana to start journey
- Features: 3 active quests, 0.5 GB storage, 7 days to explore
- CTA: "Begin as Wanderer"
- Action: Assigns `trial` plan via `provisionTrialForUser`

**Apprentice ($10/month)**
- Price: 10 gold pieces per moon cycle
- Mana: 0 mana (BYOK - bring your own spell components)
- Features: Unlimited quests, external magic channeling, 5 GB storage
- CTA: "Become Apprentice"
- Action: Triggers Stripe checkout for `basic_10` plan

**Mage ($25/month)** ⭐ Most Popular
- Price: 25 gold pieces per moon cycle
- Mana: 1,200 mana per moon cycle (guild-provided)
- Features: Pre-crafted guild spells, unlimited quests, 10 GB storage
- CTA: "Become Mage"
- Action: Triggers Stripe checkout for `pro_20` plan

## Testing Instructions

### Prerequisites
1. Start dev server: `pnpm dev`
2. Have access to the database to modify user records

### Test 1: Redirect on Login (Users with NULL plan)

**Setup:**
```sql
-- Set a test user's plan to NULL
UPDATE auth_user SET plan_id = NULL WHERE email = 'your-test-email@example.com';
```

**Steps:**
1. Log in with the test user
2. Attempt to navigate to `/dashboard`
3. **Expected:** User is automatically redirected to `/choose-path`
4. **Expected:** Page displays three rank cards with fantasy theming

### Test 2: Wanderer Plan Selection

**Steps:**
1. On `/choose-path`, click "Begin as Wanderer"
2. **Expected:** Server action provisions trial plan
3. **Expected:** User is redirected to `/dashboard`
4. **Expected:** User's `plan_id` is set to `trial`
5. **Expected:** User receives 150 trial credits
6. **Expected:** Trial period starts (7 days)

**Verification:**
```sql
SELECT plan_id, trial_started_at, trial_ends_at FROM auth_user WHERE email = 'your-test-email@example.com';
```

### Test 3: Apprentice Plan Selection

**Setup:**
```sql
-- Reset user's plan to NULL
UPDATE auth_user SET plan_id = NULL WHERE email = 'your-test-email@example.com';
```

**Steps:**
1. Navigate to `/choose-path`
2. Click "Become Apprentice"
3. **Expected:** Redirected to Stripe checkout page
4. **Expected:** Checkout for $10/month subscription
5. Complete checkout in Stripe test mode
6. **Expected:** User is redirected back to `/dashboard/billing?checkout=success`
7. **Expected:** User's `plan_id` is set to `basic_10`

### Test 4: Mage Plan Selection

**Setup:**
```sql
-- Reset user's plan to NULL
UPDATE auth_user SET plan_id = NULL WHERE email = 'your-test-email@example.com';
```

**Steps:**
1. Navigate to `/choose-path`
2. Click "Become Mage"
3. **Expected:** Redirected to Stripe checkout page
4. **Expected:** Checkout for $25/month subscription (shows "Most Popular" badge on page)
5. Complete checkout in Stripe test mode
6. **Expected:** User is redirected back to `/dashboard/billing?checkout=success`
7. **Expected:** User's `plan_id` is set to `pro_20`

### Test 5: Users with Existing Plan

**Setup:**
```sql
-- Set user to have a plan
UPDATE auth_user SET plan_id = 'trial' WHERE email = 'your-test-email@example.com';
```

**Steps:**
1. Navigate directly to `/choose-path`
2. **Expected:** User is redirected to `/dashboard`
3. **Expected:** Users with existing plans cannot access the choose-path page

### Test 6: Mobile Responsiveness

**Steps:**
1. Open `/choose-path` in browser
2. Resize to mobile viewport (375px width)
3. **Expected:** Cards stack vertically
4. **Expected:** All text remains readable
5. **Expected:** Buttons remain accessible and full-width

### Test 7: Fantasy Terminology Consistency

**Verify:**
- "gold pieces per moon" instead of "$/month"
- "mana" instead of "credits"
- "quests" instead of "ideas"
- "spell components" for API keys
- "guild spells" for included AI features
- "moon cycle" for billing period

## Edge Cases to Test

### Edge Case 1: User Closes Tab During Checkout
**Steps:**
1. Click "Become Apprentice" or "Become Mage"
2. Close browser tab on Stripe checkout
3. Return to app
4. **Expected:** User still has `plan_id = NULL`
5. **Expected:** User is redirected back to `/choose-path`

### Edge Case 2: User Already Has Plan but Plan_ID is NULL
This shouldn't happen, but if it does:
**Expected:** Middleware redirects to `/choose-path` as plan_id is the source of truth

### Edge Case 3: Database Connection Issues
**Steps:**
1. Temporarily break DATABASE_URL in `.env.local`
2. Attempt to access `/choose-path`
3. **Expected:** Graceful error handling (500 page or error boundary)

## TypeScript Verification

Run type checking:
```bash
pnpm typecheck
```

**Expected:** No TypeScript errors

## Visual QA Checklist

- [ ] Page background has gradient (background to primary/5)
- [ ] Hero heading has gradient text effect
- [ ] Mage card has border-primary (highlighted)
- [ ] Mage card has "Most Popular" badge positioned correctly
- [ ] All cards have consistent padding and spacing
- [ ] Hover effects work on all cards
- [ ] Icons/emojis display correctly in feature lists
- [ ] Buttons have correct styling (filled for Mage, outline for others)
- [ ] Footer help text with contact link displays
- [ ] Page is centered and max-width constrained

## Success Criteria (from spec)

- [x] New `/choose-path` page exists with fantasy RPG design
- [x] Three rank cards display correctly: Wanderer (free), Apprentice ($10), Mage ($25)
- [x] Fantasy terminology used consistently
- [x] Users with `plan_id = NULL` are redirected to this page
- [x] Selecting Wanderer assigns trial plan and redirects to dashboard
- [x] Selecting Apprentice/Mage triggers Stripe checkout correctly
- [x] Users with existing plans cannot access this page (redirected away)
- [x] Page is mobile responsive
- [x] TypeScript compilation succeeds
- [x] Page copy is immersive but accessible

## Notes

- The Mage plan shows 1,200 mana/month (from `INCLUDED_PLAN_CREDITS[PLAN_IDS.PRO]`)
- The spec mentioned 1,500 mana, but the constant is 1,200 - this is consistent with the pricing page
- The Wanderer plan uses the trial plan (`PLAN_IDS.TRIAL`) which provides 150 initial mana
- Middleware runs on all `/dashboard/*` routes and `/choose-path` itself
- The page uses existing `startPlanCheckoutAction` from billing actions for paid plans
- Fantasy rank names are now available in `PLAN_FANTASY_NAMES` constant for future use
