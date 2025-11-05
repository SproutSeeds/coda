---
doc: plan
id: feature-user-limitations
version: 1.0.0
lastUpdated: 2025-11-04
philosophyRef: Philosophies/feature-user-limitations-philosophy.md
tasksRef: Tasks/feature-user-limitations.md
---

# Feature User Limitations — Implementation Plan

This plan introduces tiered quotas, rate limits, and guardrails that cap how much data a user/team can create and how fast they can create it, while staying flexible for overrides and future pricing changes.

## Goals
- Protect reliability and cost by bounding growth and burst traffic.
- Provide clear, upgrade‑friendly UX when limits are reached.
- Keep enforcement centralized, testable, and easy to extend per entity.
- Support per‑plan defaults with per‑user/idea/org overrides.

## In Scope (initial wave)
- Entities and quotas (hard + soft):
  - Ideas per user/org
  - Features/cards per idea
  - Collaborators per idea
  - Public ideas per user/org
  - Join requests per idea and per viewer (cool‑down window)
  - Mutations per user/day (server‑action global cap)
- Rate limits (burst):
  - Create/Update/Share/Join server actions via Upstash Redis
- Visibility/permissions interaction:
  - Enforce create/update limits before permission checks finalize actions

Out of scope (for now): storage bytes, file attachments, workspace seats, and Postgres RLS. These can be phased in with the same patterns.

## Limit Types
- Hard limit: Block action with error and upgrade CTA.
- Soft limit: Allow action; surface warnings, email/admin alerts.
- Rate limit: Short‑term throttle (seconds/minutes) via Redis.
- Cool‑down: Prevent repeated join requests by the same viewer within N days.

## Metrics & Defaults (v1)
These are starting points; wire through config so we can adjust without code changes.

- Free
  - `ideas.per_user.lifetime`: 5
  - `features.per_idea.lifetime`: 50
  - `collaborators.per_idea.lifetime`: 3
  - `publicIdeas.per_user.lifetime`: 1
  - `joinRequests.per_idea.per_viewer.cooldownDays`: 7
  - `mutations.per_user.daily`: 500
- Pro
  - 50 / 500 / 10 / 10 / 3 days / 5k
- Team
  - 500 / 5k / 50 / 100 / 1 day / 25k

## Data Model
Add explicit plan, usage, and override tables. Keep counters fast, but reconcile nightly to avoid drift.

- `plans`
  - `id` (pk), `name`, `is_default boolean`, `features jsonb` (limit catalog)
- `user_plans`
  - `user_id fk`, `plan_id fk`, `org_id fk?`, `starts_at`, `ends_at` (nullable)
- `limit_overrides`
  - `id` (pk), `scope_type enum('user','idea','org')`, `scope_id uuid`, `metric text`, `limit_value int`, `expires_at`, `reason text`, `created_by uuid`, `created_at`
- `usage_counters`
  - `scope_type enum('user','idea','org')`, `scope_id uuid`, `metric text`, `period enum('lifetime','daily','monthly')`, `period_key text` (e.g., `2025-11-04`), `count bigint`, `updated_at`
  - Composite PK: `(scope_type, scope_id, metric, period, period_key)`
- `audit_limit_events`
  - `id`, `scope_type`, `scope_id`, `metric`, `event enum('warn','block')`, `value int`, `limit int`, `action text`, `meta jsonb`, `created_at`

Drizzle locations (proposed):
- `lib/db/schema/plans.ts`, `lib/db/schema/limits.ts`
- Helpers in `lib/db/limits.ts` for counters and overrides.

## Effective Policy Resolution
At enforcement time compute:
`effectiveLimit = override ?? plan.features[metric] ?? defaults[metric]`

Cache per user/plan in Redis for 5–15 minutes; bust on override change.

## Enforcement Strategy
- Centralize checks in `lib/limits/guard.ts`:
  - `checkLimit({ scope, metric, increment, period, tx })`
  - Reads effectiveLimit, current usage (from `usage_counters` with fallback compute), decides `allow|warn|block`.
  - When allowed, increments the counter within the same transaction as the business write.
- Server Actions integration (examples):
  - `createIdeaAction` → check `ideas.per_user.lifetime` with scope=user.
  - `addFeatureAction` → `features.per_idea.lifetime` with scope=idea.
  - `addCollaboratorAction` → `collaborators.per_idea.lifetime` with scope=idea.
  - `publicizeIdeaAction` → `publicIdeas.per_user.lifetime` with scope=user.
  - `submitJoinRequestAction` → cool‑down + `joinRequests.per_idea.per_viewer` via Redis key: `join:${ideaId}:${viewerId}` TTL days.
  - Global mutation caps → wrap `withMutationBudget(userId, weight=1)` around all mutating actions.
- Rate limiting (Redis / Upstash):
  - Token bucket per action key `rate:{action}:{userId}`; keep burst/fill from config per plan.

## UX & Messaging
- Show usage bars and counts:
  - Account → “Usage & Limits” section for the user scope.
  - Idea detail → per‑idea usage (features, collaborators).
- On block:
  - shadcn Dialog with reason, current usage vs limit, and Upgrade CTA.
  - Maintain accessibly‑worded inline errors on forms and disable dangerous buttons when already at limit.
- On soft warn:
  - Toast + subtle indicator; continue action.

## Admin & Ops
- Admin page to manage overrides (`/dashboard/admin/limits`): search user/idea, set metric, value, expiry, reason.
- Observability:
  - Emit analytics event `limit.blocked`/`limit.warned` with metric and scope.
  - Grafana/Datadog (or Vercel Analytics) charts for block rates.
- Nightly reconcile job:
  - Cron (Vercel Scheduler): compute authoritative counts from base tables and upsert `usage_counters`.

## Migrations (Drizzle)
1. Add new tables.
2. Seed `plans` (Free, Pro, Team) and backfill `user_plans` to default Free.
3. Initial counters backfill script scanning existing rows (ideas, features, collaborators, public ideas).

## Code Structure
- `lib/limits/types.ts` — enums for `Metric`, `ScopeType`, `Period`.
- `lib/limits/policies.ts` — load plan limits + defaults.
- `lib/limits/guard.ts` — core checker/incrementer.
- `lib/limits/rate.ts` — thin Upstash wrapper with per‑plan configs.
- `lib/limits/reconcile.ts` — nightly reconcile utilities.
- Wire guards in server actions under `app/**/actions/*.ts`.

## Pricing & Billing Model
- Credit-based fuel system: $5/month subscription loads a monthly pack of non-expiring Coda Credits (e.g., 500 credits) that users can bank and spend as needed.
- Credits only apply to cloud consumption (ideas stored, features created, invites emailed, join requests processed, login emails, Dev Mode minutes, analytics events, exports). Local/offline work consumes zero credits.
- Maintain a `vendor_costs` matrix with conservative per-action cost (raw vendor price + safety buffer). Update the table when suppliers change pricing.
- Usage logging writes to `usage_costs` with payer (user or workspace), vendor, quantity, raw cost, credits deducted, and plan attribution. Nightly reconcile checks actual bills vs projections.
- Default auto top-up option: when credits drop below threshold, Stripe charges and refuels before cloud work pauses. Manual top-ups supported via dashboard.
- Dashboard shows remaining credits, projected month-end spend, and plan comparison. Limit modals offer top-up, upgrade, or local fallback.
- Stripe invoices list subscription fee (platform value) plus credit purchases; itemized statements reference the ledger export.

### Dev Mode Billing & Funding Pool
- Default policy: collaborator who launches Dev Mode pays from their personal allowance; usage is logged against their account first.
- Workspace owners can opt into covering minutes: “workspace covers all”, or “shared pool” with pre-funded credits collaborators draw down.
- Guard metrics include `devmode.minutes` and `devmode.bytes`; warnings at 80% of allowance, hard-stop with upgrade/options when exceeded.
- Dashboard surfaces per-user Dev Mode consumption so owners can monitor usage regardless of payer.
- Funding pools deduct from workspace credits and expose remaining balance + refill CTA; alerts fire when pool hits configurable thresholds.

### Usage Dashboard & Reporting
- Account → Usage displays per-action counts, remaining credits, projected month-end spend, and plan comparison.
- Provide CSV/JSON export of the ledger and a “download cost report” button; include hover tooltips explaining each counter.
- Limit modals include actionable CTAs: upgrade, ask owner to sponsor, or switch to local tooling.
- Admin view lists overrides, recent limit events, and high-cost users for proactive support.

## Pseudocode
```ts
// lib/limits/guard.ts
export async function checkAndConsume(options: {
  scope: { type: 'user'|'idea'|'org'; id: string };
  metric: Metric;
  period?: Period; // default lifetime
  increment?: number; // default 1
  tx?: DBTransaction; // drizzle tx, when provided we use it
}) {
  const limit = await resolveEffectiveLimit(options.scope, options.metric);
  if (!limit) return { allowed: true, mode: 'unlimited' };

  const { count } = await getUsage(options.scope, options.metric, options.period);
  if (count >= limit.hard) {
    await logLimitEvent('block', ...);
    return { allowed: false, reason: 'hard', limit: limit.hard, count };
  }
  const next = count + (options.increment ?? 1);
  const mode = next > limit.soft ? 'warn' : 'ok';
  await incrementUsage(options, { next });
  if (mode === 'warn') await logLimitEvent('warn', ...);
  return { allowed: true, mode };
}
```

## Tests
- Unit: policy resolution, counters, increment within tx, soft vs hard branching, cool‑down edge cases, Redis failures fallback.
- Integration: mutate actions under seeded plans; verify blocks; reconcile adjusts drift.
- E2E (smoke): UI disables buttons when at limit; upgrade modal appears.

## Rollout Plan
1. Phase 0 (monitor): compute usage, no blocks; show usage UI.
2. Phase 1 (soft): enable warnings when exceeding soft limit.
3. Phase 2 (hard): enable blocks for Free; Pro/Team soft only initially.
4. Phase 3: enable hard for all tiers; publish pricing doc.

## Risks & Mitigations
- Counter drift → nightly reconcile + admin tool to resync now.
- Hot path latency → cache plan and counters; minimal joins; use Redis for burst.
- False blocks due to race → increment within same DB transaction as business write.
- Complexity creep → centralize metrics in a single enum and map; forbid ad‑hoc checks elsewhere.

## Timeline (suggested)
- Week 1: schema + guard + integration on createIdea/addFeature + usage UI.
- Week 2: collaborators/publicize/join requests + admin overrides + reconcile job.
- Week 3: tests + monitor rollout (Phase 0→1) + polish + docs.

## Developer Checklist
- [ ] Drizzle migrations added and reviewed
- [ ] Guard wired into all mutating server actions
- [ ] Redis rate limiter keys aligned with metrics
- [ ] Nightly reconcile deployed
- [ ] Usage UI surfaces in Account and Idea
- [ ] Admin override screen
- [ ] Tests: unit/integration/E2E basic
- [ ] Observability dashboards and alerts
