---
doc: tasks
id: feature-user-limitations
planRef: Plans/feature-user-limitations.md
planVersion: 1.0.0
philosophyRef: Philosophies/feature-user-limitations-philosophy.md
lastUpdated: 2025-11-04
status: draft
---

# Feature User Limitations — Task List

## Cost Catalogue UI
- [x] Ship `app/dashboard/billing/cost-catalogue/page.tsx` that loads plan, vendor, and credit data via `getCostCatalogue()`.
- [x] Build client grid components with filters, responsive layout, and accessible keyboard/focus behavior.
- [x] Implement loading, empty, and error fallbacks plus cached-data warning banner.
- [x] Wire analytics events (`costCatalogue.filter.changed`, `costCatalogue.cta.clicked`) and ensure upgrade/top-up CTAs route correctly.
- [x] Cover the catalogue with unit snapshots, integration assertions for filter logic, and an E2E smoke path from billing navigation.

## Provider Cost Synchronization
- [x] Create provider cost tables (`provider_cost_events`, `provider_cost_snapshots`, `provider_cost_reconciliations`) and Drizzle helpers for upserts + variance logging.
- [x] Implement provider adapters for Neon, Vercel, Upstash, and Fly.io that normalize their billing APIs and emit ledger entries.
- [x] Extend the vendor reconciliation cron to trigger provider syncs and return drift data alongside internal expectations.
- [x] Add unit coverage for provider sync to ensure snapshots, events, and reconciliation logic persist as expected.

## Data Model & Persistence
- [x] Create `lib/db/schema/plans.ts` and `lib/db/schema/limits.ts` with tables: `plans`, `user_plans`, `limit_overrides`, `usage_counters`, `audit_limit_events`.
- [x] Generate migrations that add the new tables and constraints (composite PKs, FKs), using `pnpm drizzle-kit generate`.
- [x] Write a backfill script to seed default plan entries (Free, Pro, Team) and populate `user_plans` for existing users.
- [x] Add nightly reconcile helper in `lib/limits/reconcile.ts` to backfill `usage_counters` from canonical tables.

## Domain Helpers & Policies
- [x] Create `lib/limits/types.ts` enumerating metrics, scope types, and periods.
- [x] Implement `lib/limits/policies.ts` to load defaults per plan tier and merge overrides.
- [x] Build `lib/limits/guard.ts` that resolves effective limits, increments counters transactionally, and returns allow|warn|block.
- [x] Add `lib/limits/rate.ts` wrapper for Upstash token buckets per action + plan tier.
- [x] Introduce `logUsageCost` helper that records vendor, action, quantity, and payer (user/workspace) into `usage_costs`.
- [x] Extend guard/enforceLimit to support payer resolution (collaborator vs workspace funding pool) and shared credit handling.

## Server Actions & API Wiring
- [x] Instrument guard checks in `app/dashboard/ideas/actions` (create idea, add feature, add collaborator, publicize idea, submit join request, share/export actions).
  - [x] `createIdeaAction` — enforce rate guard before `createIdea` call.
  - [x] `createFeatureAction` — enforce rate guard before `createFeature`.
  - [x] Collaborator invite + approvals (with mutation budget).
  - [x] Idea publicize / visibility changes.
  - [x] Join request submit + owner resolution.
  - [x] Exports (single + bulk) throughput.
  - [x] Collaborator additions log credit usage (invite acceptance, join approvals).
- [x] Ensure approvals (e.g., join-request acceptance) create collaborators transactionally with counter updates.
- [x] Add global mutation budget middleware that wraps mutating server actions (`withMutationBudget`).
- [x] Expose admin endpoints/actions for listing pending overrides and resolving them.
- [x] Attach `logUsageCost` to each billable action (ideas, features, invites, join requests, exports, Dev Mode sessions, analytics events, login emails).
- [x] Implement Dev Mode session logging capturing userId, ideaId, minutes, bytes, payer, and pool deductions when applicable.
- [x] Implement credit ledger: purchase flow, balance queries, auto top-up triggers, manual top-up endpoint.
- [x] Integrate credit deduction into guard/enforceLimit so cloud actions consume credits before proceeding.

## UX, Surfaces & Notifications
- [x] Add “Usage & Limits” panel in Account settings displaying user-level quotas and consumption bars.
- [x] Extend Idea detail to show per-idea usage (features, collaborators, join requests) and disable controls when blocked.
- [x] Integrate shadcn Dialog for hard-limit blocks with upgrade CTA, and sonner toasts for soft warnings.
- [x] Add badge/indicator on Share/Join queue when pending requests exist.
- [x] Wire analytics events (`limit.warned`, `limit.blocked`) and optional email/toast notifications for owners.
- [x] Build Usage dashboard: summary strip, per-action table, plan comparison, cost export.
- [x] Add Dev Mode usage widget (personal minutes remaining, workspace policy) and pre-session warning modal.
- [x] Update limit modals to offer upgrade, request sponsor, or switch to local tooling guidance.
- [x] Expose credit balance, top-up buttons, and plan comparison in dashboard; show per-action credit deductions with vendor context.

## Admin & Operations
- [x] Build `/dashboard/admin/limits` page to view pending overrides, create/update overrides with expiry and reason, and monitor block rates.
- [x] Add nightly job (Vercel Scheduler / cron) invoking reconcile utility and logging summary metrics.
- [x] Instrument Grafana/Vercel dashboards for limit enforcement counts.
- [x] Provide admin billing console showing usage ledger, high-cost users, and funding pool balances; enable overrides and credit grants.
- [x] Add nightly vendor reconciliation job comparing estimated vs actual cost; adjust multipliers or alert on drift.

## Testing
- [x] Unit tests for policy resolution, counter increments, and guard outcomes (allow/warn/block).
- [x] Integration tests covering server actions under different plan tiers and override scenarios.
- [x] E2E tests ensuring UI disables actions and surfaces correct messaging when limits are hit.
- [x] Tests for join request cool-down (Redis TTL) and duplicate prevention.
- [x] Add smoke tests for nightly reconcile (deterministic sample data) and admin override flows.

## Rollout & Documentation
- [x] Phase 0: enable counters + UI readouts without blocking; monitor analytics.
- [x] Phase 1: activate soft warnings for Free plan; communicate via changelog.
- [x] Phase 2: enforce hard blocks on Free, soft warnings on Pro/Team; gather feedback.
- [x] Phase 3: tighten Pro/Team limits as needed, publish pricing doc + migration guide.
- [x] Update README/Docs with new usage/limits experience and support FAQs.
- [x] Publish pricing/cost transparency doc explaining pass-through model, dev mode billing choices, and collaborator funding pools.
- [x] Document credit system (how credits are earned/spent, how to top up, auto-refill, shared pools) and update onboarding/tooltips.
