<objective>
Create a fantasy RPG-themed plan selection page (/choose-path) that users see when they have no plan assigned. This page introduces users to the Coda realm and lets them choose between three adventurer ranks: Wanderer (free), Apprentice ($10/mo), and Mage ($25/mo).

This is a critical onboarding experience that sets the tone for the entire app and converts new users into paying subscribers through immersive fantasy storytelling.
</objective>

<context>
You're working on the Coda monetization system which uses a fantasy mana/RPG theme inspired by EverQuest. The full fantasy theme brainstorm is in the Philosophies folder.

**Current State:**
- Users with `plan_id = NULL` need to choose a plan before using the app
- Existing `/pricing` page exists but uses generic SaaS language
- We have three plan IDs in the database: `free`, `basic_10`, `pro_20`
- Fantasy rank mapping: free → Wanderer, basic_10 → Apprentice, pro_20 → Mage

**Fantasy Theme Overview:**
- Credits = Mana
- Subscriptions = Adventurer ranks
- AI usage = Casting spells
- Top-ups = Mana potions
- Billing cycle = Moon cycle

Read CLAUDE.md for project conventions.

@app/pricing/page.tsx
@app/dashboard/billing/actions.ts
@lib/plans/constants.ts
@Philosophies/feature-monetization-system-philosophy.md
</context>

<requirements>
1. **Create New Page: `/choose-path`**
   - Server component that checks if user has `plan_id = NULL`
   - If user has a plan, redirect to `/dashboard`
   - Beautiful, immersive fantasy design with RPG aesthetics

2. **Three Adventurer Rank Cards**

   **WANDERER (Free Plan)**
   - Price: Free forever
   - Mana: 0 mana/month
   - Features: Explore the realm, 3 active quests (ideas), 1 GB storage
   - CTA: "Begin as Wanderer" (no checkout, just assigns `free` plan)
   - Description: "Curious traveler just entering the realm"

   **APPRENTICE ($10/month)**
   - Price: 10 gold pieces per moon
   - Mana: 0 mana (bring your own spell components - API keys)
   - Features: Unlimited quests, channel external magic (BYOK), 5 GB storage
   - CTA: "Become Apprentice" (triggers Stripe checkout)
   - Description: "Learning the basics, using your own magic"
   - Fantasy flavor: DIY magic users who prefer to manage their own spell components

   **MAGE ⭐ ($25/month)**
   - Price: 25 gold pieces per moon
   - Mana: 1,500 mana/month (guild-provided, regenerates monthly)
   - Features: Pre-crafted spells, unlimited quests, guild spellbook, 10 GB storage
   - CTA: "Become Mage" (triggers Stripe checkout)
   - Badge: "Most Popular" or "Recommended"
   - Description: "Apprenticed to the guild, using guild-provided magic"
   - Fantasy flavor: Guild members with pre-built, reliable spells

3. **Page Copy & Messaging**
   - Hero heading: "Choose Your Path in the Realm" or similar epic title
   - Subheading: Explain the mana system briefly ("Mana powers your spells...")
   - Use EverQuest-inspired language throughout
   - Maintain immersive tone but keep it accessible (not overly complex)

4. **Visual Design**
   - RPG/fantasy aesthetic (think quest boards, guild halls)
   - Mage card should stand out (highlighted border, badge)
   - Use existing shadcn/ui components but styled for fantasy theme
   - Responsive: stack cards on mobile, grid on desktop
   - Framer Motion animations (cards fade in, subtle hover effects)

5. **Server Actions Integration**
   - Wanderer: Simple server action that sets `plan_id = 'free'` and redirects to `/dashboard`
   - Apprentice: Uses existing `startPlanCheckoutAction(PLAN_IDS.BASIC)` from billing actions
   - Mage: Uses existing `startPlanCheckoutAction(PLAN_IDS.PRO)` from billing actions

6. **Middleware/Routing**
   - Add middleware or layout logic to redirect users with `plan_id = NULL` to `/choose-path`
   - Users with existing plans should never see this page
   - After plan selection, redirect to dashboard or success page

7. **Fantasy Terminology Consistency**
   - Use "gold pieces per moon" instead of "$/month"
   - Use "mana" instead of "credits"
   - Use "quests" instead of "ideas"
   - Use "spell components" for API keys
   - Use "guild spellbook" for included AI features
</requirements>

<implementation>
**DO:**
- Create a new route at `app/choose-path/page.tsx`
- Use existing shadcn/ui components (Card, Button, etc.) styled for fantasy theme
- Add Framer Motion animations for card reveals and hover states
- Create a server action `selectWandererPlan()` that assigns the free plan
- Reuse `startPlanCheckoutAction` from `app/dashboard/billing/actions.ts` for paid plans
- Add middleware in `middleware.ts` or layout redirect logic to enforce plan selection
- Use Tailwind classes that match the existing design system
- Keep the UI trustworthy and accessible despite fantasy theme (clear pricing, no dark patterns)

**WHY these constraints matter:**
- Middleware redirect ensures EVERY user without a plan sees this page (critical conversion funnel)
- Reusing existing checkout actions ensures consistency with rest of billing flow
- Fantasy theme differentiates Coda from boring SaaS competitors (viral marketing potential)
- Clear pricing maintains trust (users need to understand what they're paying for)
- Accessibility ensures the fantasy theme doesn't exclude users with disabilities

**DON'T:**
- Overthink the fantasy theme - keep it fun but not overwhelming
- Hide pricing or make it confusing
- Break existing Stripe integration
- Skip mobile responsiveness
- Forget to handle loading states during checkout redirect

**Visual Hierarchy:**
1. Hero heading (large, bold)
2. Brief explanation of mana system
3. Three rank cards (Mage highlighted)
4. Footer with help/support link

**Card Structure:**
```
┌─────────────────────────┐
│ RANK BADGE (if any)     │
│                         │
│ RANK NAME               │
│ Price in gold/moon      │
│                         │
│ Description text        │
│                         │
│ Feature list:           │
│ • Mana amount           │
│ • Quest limit           │
│ • Storage               │
│ • Special features      │
│                         │
│ [CTA Button]            │
└─────────────────────────┘
```
</implementation>

<output>
Create or modify these files:

**New Files:**
- `app/choose-path/page.tsx` - Main plan selection page with fantasy theme
- `app/choose-path/actions.ts` - Server action for free plan assignment

**Modified Files:**
- `middleware.ts` or relevant layout file - Add redirect logic for users with no plan
- `lib/plans/constants.ts` - Add fantasy rank names if not already present

**Optional (if needed):**
- `app/choose-path/layout.tsx` - Minimal layout for onboarding flow
- Update `app/pricing/page.tsx` to use consistent fantasy terminology
</output>

<verification>
Before declaring complete, verify your work:

1. **Test with NULL plan user:**
   ```bash
   # Set your plan to NULL
   psql "YOUR_DB_URL" -c "UPDATE auth_user SET plan_id = NULL WHERE email = 'codyshanemitchell@gmail.com';"

   # Start dev server
   pnpm dev

   # Navigate to any authenticated route - should redirect to /choose-path
   ```

2. **Test each plan selection:**
   - Click "Begin as Wanderer" → should assign `free` plan and redirect to dashboard
   - Click "Become Apprentice" → should redirect to Stripe checkout for $10 plan
   - Click "Become Mage" → should redirect to Stripe checkout for $25 plan

3. **Test with existing plan:**
   - User with `plan_id = 'free'` should NOT see `/choose-path` when navigating to it
   - Should redirect to dashboard

4. **Visual QA:**
   - Cards stack on mobile
   - Mage card is highlighted/stands out
   - Animations are smooth (fade in, hover effects)
   - Fantasy language is consistent
   - Pricing is clear and not misleading

5. **Type Check:**
   ```bash
   pnpm typecheck
   ```
</verification>

<success_criteria>
1. New `/choose-path` page exists with fantasy RPG design
2. Three rank cards display correctly: Wanderer (free), Apprentice ($10), Mage ($25)
3. Fantasy terminology used consistently (mana, gold pieces, moon cycles, quests, spells)
4. Users with `plan_id = NULL` are redirected to this page on login/navigation
5. Selecting Wanderer assigns free plan and redirects to dashboard
6. Selecting Apprentice/Mage triggers Stripe checkout correctly
7. Users with existing plans cannot access this page (redirected away)
8. Page is mobile responsive and visually appealing
9. TypeScript compilation succeeds
10. Page copy is immersive but accessible (EverQuest vibes without being confusing)
</success_criteria>

<examples>
**Example Hero Section:**
```tsx
<section className="text-center">
  <h1 className="text-5xl font-bold">Choose Your Path in the Realm</h1>
  <p className="mt-4 text-lg text-muted-foreground">
    Every adventurer needs mana to cast spells. Choose how you'll power your journey.
  </p>
</section>
```

**Example Rank Card (Mage):**
```tsx
<Card className="relative border-2 border-primary shadow-lg">
  <div className="absolute -top-3 right-4 bg-primary px-3 py-1 rounded-full text-white text-sm">
    ⭐ Most Popular
  </div>
  <CardHeader>
    <h3 className="text-2xl font-bold">MAGE</h3>
    <p className="text-xl">25 gold pieces per moon</p>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground mb-4">
      Apprenticed to the guild, using guild-provided magic
    </p>
    <ul className="space-y-2">
      <li>⚡ 1,500 mana / month</li>
      <li>📜 Pre-crafted guild spells</li>
      <li>∞ Unlimited quests</li>
      <li>📦 10 GB mage tower storage</li>
    </ul>
  </CardContent>
  <CardFooter>
    <form action={startMageCheckout}>
      <Button className="w-full">Become Mage</Button>
    </form>
  </CardFooter>
</Card>
```
</examples>

<research>
Before implementing, review:
- Existing `/pricing` page design patterns for consistency
- Billing actions to understand checkout flow
- Plans constants to ensure correct plan IDs used
- Fantasy theme philosophy document for tone/voice
</research>

<notes>
**Priority:** HIGH - This is the first impression for all new users

**Tone:** Immersive fantasy but approachable. Think "friendly DM" not "academic lore dump"

**Marketing Hook:** This page will get screenshotted and shared. Make it visually stunning.

**Conversion Focus:** Most users should pick Mage (middle tier). Use visual hierarchy and "Most Popular" badge.

**Accessibility:** Don't sacrifice usability for theme. Screen readers should understand pricing clearly.
</notes>
