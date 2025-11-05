# Usage Limits, Credits, and Pricing Transparency

Last updated: 2025-11-04

This document describes how Coda enforces usage limits, tracks costs, and communicates pricing as we roll out the credit-based funding model. It is the single reference for engineering, product, support, and finance when discussing limits, credits, or billing-related questions.

---

## 1. Limit Enforcement Overview

- **Guardrails**: every mutation and high-cost action routes through `enforceLimit` + `withMutationBudget`. The guard evaluates the active plan, approved overrides, usage counters, and pending credits before allowing, warning, or blocking a request.
- **Counters**: `usage_counters` keep per-scope tallies by metric/period. Nightly reconcile (`/api/cron/reconcile-usage`) realigns counters with canonical tables for ideas, features, collaborators, and public idea totals.
- **Events**: `audit_limit_events` records warn/block events. Admin views (`/dashboard/admin/limits`) surface 24h/7d/30d block rates using this audit trail.
- **Overrides**: pending requests funnel into the admin queue. Approvals immediately adjust hard limits and register the override against the scope. Manual overrides can be created on demand (e.g., hackathon allowance, support gesture) and optionally expire.

Supporting endpoints/components:

| Surface | Path | Purpose |
| --- | --- | --- |
| Usage dashboard | `/dashboard/usage` | Shows credit balance, per-action usage, cost aggregates, and plan comparison with export.
| Idea usage widget | `app/dashboard/ideas/components/IdeaUsageSummary.tsx` | Surface per-idea counters and block context paddles.
| Dev Mode usage | `app/dashboard/ideas/components/DevModeUsageWidget.tsx` | Live session budgeting, local fallback guidance, and post-session cost summary.
| Admin limits | `/dashboard/admin/limits` | Pending override review, manual override creation, block-rate analytics.
| Admin billing | `/dashboard/admin/billing` | High-cost users, shared pools, and credit grants.
| Reconcile cron | `/api/cron/reconcile-usage` | Nightly counter reconciliation (requires `Authorization: Bearer ${CRON_SECRET}`).
| Vendor drift cron | `/api/cron/reconcile-vendor` | Daily vendor comparison, raises alerts when spend diverges from estimates.

---

## 2. Credits & Funding Model

- **Ledger**: `credit_balances` and `credit_transactions` track prepaid credits by payer (user or workspace). All cloud-cost actions produce a debit event via `chargeCredits`—no action runs without a funding source once Phase 2 begins.
- **Acquisition**: credits enter the system via Stripe checkout (to be wired), admin grants, or workspace funding pools. Auto top-up triggers when balances dip below configurable thresholds.
- **Consumption**: `withMutationBudget` resolves the payer (actor vs. workspace) and deducts credits before allowing a mutation. Dev Mode minutes/bytes, collaborator invites, exports, join approvals, login emails, and analytics events now log cost entries.
- **Transparency**: every debit includes vendor metadata (e.g., Upstash request unit, Neon storage MB-month). The usage dashboard translates those units into credits and estimated USD so customers understand the pass-through nature of billing.
- **Local Path**: whenever a hard block occurs, the Upgrade dialog presents alternatives—workspace sponsorship, purchasing credits, or exporting to the CLI / offline runner.

### Credit Quick Reference

| Scenario | Who pays by default | Metric | Credit weight |
| --- | --- | --- | --- |
| Idea creation | Actor (user) | `ideas.per_user.lifetime` + `idea.create` cost log | 1 credit |
| Feature creation | Actor | `features.per_idea.lifetime` | 1 credit |
| Collaborator invite approval | Actor (invitee) or workspace pool | `collaborators.per_idea.lifetime` | 2 credits |
| Join request approval | Owner (workspace) | `joinRequests.per_idea` | 1 credit |
| Dev Mode minute | Actor unless workspace sponsorship explicitly set | `devmode.minute` | 1.5 credits per minute |
| Dev Mode bandwidth | Actor | `devmode.byte` | 1 credit per 25MB |
| Login email | Platform | `auth.email` | 0.1 credits |

> **Note**: We maintain a healthy free tier by granting 100 credits/month to new accounts. Credits never expire; they stack similar to Splice credits so users can bank for large bursts. Admins can allocate workspace pools for community-funded ideas.

---

## 3. Rollout Phases

| Phase | Timeline | Behavior | Goals |
| --- | --- | --- | --- |
| **Phase 0** | Feature flags on staging/dev | Counters + dashboard visible, no blocking. Log warn/block analytics silently. | Validate instrumentation, gather baseline usage, train support. |
| **Phase 1** | Early production (opt-in accounts) | Soft warnings for Free plan when credits fall below 20% and when limit threshold crosses warn ratio. No hard stops. | Educate users, tune credit weights, refine copy. |
| **Phase 2** | Production general availability | Hard blocks on Free plan when credits exhausted. Pro/Team see soft warnings + optional workspace-funded overrides. | Ensure profitability on cloud usage, verify credit purchase flow. |
| **Phase 3** | Post-feedback tightening | Adjust Pro/Team thresholds, enable automatic workspace pools, expand Dev Mode pricing. Publish official pricing doc and migration guide. | Balance cost recovery with user value, ship docs + support playbooks. |

Release checklist per phase:

1. Update `Plans/<branch>.md` with phase gating + feature flags.
2. Run `pnpm doc:sync && pnpm doc:check-sync` to confirm Plans ↔ Philosophies ↔ Tasks alignment.
3. Notify support with playbook snippet from `docs/playbook/billing-support.md`.
4. Tag release notes with **Usage & Limits** section summarizing changes.

---

## 4. Pricing & Transparency Messaging

- **Pass-through philosophy**: customers only pay when we incur cloud costs. Every modal, toast, and dashboard entry states the estimated vendor rate (Upstash requests, Neon storage, Vercel analytics events, Fly.io relay minutes) and how many credits that consumes.
- **Dashboard copy**: the Usage page highlights remaining credits, forecasted run-out date, and per-action cost with vendor callouts (e.g., “Join request approval – 1 credit (covers Neon write + Upstash rate-limit check)”).
- **Billing history**: monthly receipts include itemized usage pulled from `usage_costs` ledger. Expose the ledger via CSV export on `/dashboard/usage`.
- **Support guidance**: upgrade modal offers three choices—purchase credits, request workspace sponsorship, or export data to continue offline (CLI agent / local runner). The modal also surfaces recent high-cost actions to explain why the user hit a block.

Call-to-action copy (for LimitDialog + toasts):

> “Cloud credits cover the vendor costs (Postgres, Redis, Dev Mode relay). You’re out for this month, but you can top up, ask your workspace to sponsor the idea, or export everything to continue offline in the CLI.”

---

## 5. Admin & Support Operations

- **Override queue**: `/dashboard/admin/limits` now displays pending requests, manual override form, and block-rate analytics. Support should include rationale + expiry when approving.
- **Billing console**: `/dashboard/admin/billing` surfaces users with high spend, workspace balances, and quick grant buttons.
- **Cron secrets**: configure `CRON_SECRET` in Vercel/runner envs. Without it, reconcile routes return 401. Share the secret only with scheduled jobs.
- **Alerting**: `reconcile-vendor` cron logs divergence. Hook into monitoring (Grafana/Vercel) to alert finance when estimated vs actual cost difference >15%.
- **Data exports**: API endpoint `/dashboard/usage/export` streams usage ledger as JSON for audits; link exposed in dashboard (under “Download ledger”).

---

## 6. Documentation Checklist

- README updated (**Usage & Credits** section) – includes user-facing summary + link back to this doc.
- Support FAQ (docs/playbook/billing-support.md) – create/adjust entries for “Why did I hit a limit?”, “How to top up credits?”, “How to sponsor a collaborator?”.
- Release notes – add a card summarising credit system rollout before each phase.
- Plan/Philosophy/Tasks – guard ensures new branches stay aligned; revisit when pricing changes land.

---

### Open Questions / Next Iteration

- Stripe integration for credit purchase (pending tasks).
- Shared workspace pools: need UI for owners to allocate budgets before Phase 3.
- CLI/local runner packaging for offline mode (documented in `docs/runner-packaging.md`, needs refresh once credit enforcement goes live).

Please keep this document current as we adjust pricing, metrics, or workflows. Update the Last updated date and summarize deltas in the release notes.
