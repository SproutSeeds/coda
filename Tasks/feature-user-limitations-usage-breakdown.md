---
doc: tasks
id: feature-user-limitations-usage-breakdown
planRef: Plans/feature-user-limitations-usage-breakdown.md
planVersion: 0.1.0
philosophyRef: Philosophies/feature-user-limitations-philosophy.md
lastUpdated: 2025-11-08
status: draft
---

# Transparent Usage Breakdown UI — Task List

## 1. Data Model Enhancements
- [x] Expand `lib/pricing/cost-model.ts` entries with `category`, `label`, `description`, and human-readable `unitLabel` so every billable action knows how it should render in the accordion UI.
- [x] Add `UsageCostBudget` helpers in `lib/pricing/cost-model.ts` that calculate purchasable units for the $5/$20/$100 projections (returns `{budgetUsd, unitsPurchasable, summary}`) for every `UsageAction`.
- [x] Mirror storage pricing metadata by extending `lib/usage/storage.ts` with category descriptions, Tailwind color tokens, and helper functions for computing projections from `STORAGE_PRICING`.
- [x] Update `lib/usage/types.ts` to include the richer metadata (`category`, `unitLabel`, `description`, `projections`, `lastOccurredAtIso`) that both the server aggregator and client panels will consume.
- [x] Sync `docs/cost-calculation-guide.md` and `docs/usage-limits-and-pricing.md` so the documented vendor rates, unit costs, and projection examples match the new metadata (include table/CSV snippets users will see in the dashboard).

## 2. Server Aggregation Contract
- [x] Rewrite `lib/usage/analytics.ts#getUserUsageDashboard` to start from the full `COST_MODEL` list, merge ledger usage, and emit rows for **every** action even when no usage has been logged (quantity/cost defaults to zero).
- [x] Group actions by category server-side (leveraging `lib/usage/categories.ts`) so the client receives a normalized `{category, actions[]}` structure with consistent ordering (Creation → Storage).
- [x] Compute and attach the $5/$20/$100 projection payloads per action/storage class server-side to avoid client math; reuse the helper from the cost-model layer.
- [x] Include lifetime totals, last-occurrence timestamps, and unit-cost metadata for both action and storage entries so the UI can surface “last used” text and tooltip formulas without extra queries.
- [x] Ensure `UsageDashboardData` plus downstream DTOs (`UsageOverviewClientPayload`, CSV export) expose the same fields so exports, analytics, and the accordion stay in sync.

## 3. Client UI Structure
- [x] Replace the single “Cost reference” card in `app/dashboard/usage/CategoryActionTable.tsx`/`UsageDashboardClient.tsx` with one accordion card per category (Creation, Collaboration, Delivery, Authentication, Analytics, Dev Mode, Storage).
- [x] Build a reusable accordion component (likely `app/dashboard/usage/components/UsageAccordion.tsx`) that wraps shadcn’s `Accordion` primitives, handles chevrons/animations, and accepts category metadata + rows.
- [x] Inside each accordion panel, render every action from the server payload with: color chip, action label, tooltip trigger, lifetime spend, quantity (formatted via `formatBytes` when needed), and inline `$5/$20/$100` projection chips (e.g., “$20 ≈ 8.4M rows”).
- [x] Provide empty-state rows for categories with zero usage (“No tracked actions yet”) while still showing unit pricing + projection hints so the user understands potential costs even before activity exists.
- [x] Update the main header/summary cards in `UsageDashboardClient` to reference the new per-category totals (e.g., show how many panels are active, tie category colors back to the chart legend).

## 4. Tooltips & Projection Chips
- [x] Create a `UsageCostTooltip` (shadcn Tooltip/Popover) that renders the action description, vendor, unit cost formula, and projection table; wire it to the info icon in each accordion row using accessible triggers.
- [x] Implement a `ProjectionChips` component that accepts the precomputed projections and renders consistent pill styling (`$5 buys 1.2M emails`, `$100 ≈ 2.4 GB`) with fallback text for bytes/minutes.
- [x] Ensure projections + tooltip content also power other surfaces (e.g., `/dashboard/usage` export CTA, upgrade dialog), so centralize the formatting helpers under `app/dashboard/usage/components/`.

## 5. Mobile + Accessibility
- [x] Verify accordions collapse into a stacked layout on small screens (Tailwind responsive classes + CSS grid tweaks) and keep tap targets ≥44px.
- [x] Add full keyboard control: `Enter`/`Space` toggles accordion headers, focus rings are visible, and `aria-controls`/`aria-expanded` attributes map to panel IDs.
- [x] Respect `prefers-reduced-motion` by disabling accordion animation + chart transitions when the user has the setting enabled (Framer Motion + CSS media queries).
- [x] Validate dark/high-contrast modes: color chips, projection pills, and tooltip surfaces must meet contrast requirements (≥4.5:1) and avoid relying solely on color to convey state.

## 6. Validation & QA
- [ ] Seed deterministic fixture data (either via `scripts/seed-usage-dashboard.ts` or provider-sync harness) that produces non-zero usage for every category + storage class so designers/support can review realistic screenshots.
- [ ] Add unit tests under `tests/unit/lib/usage/analytics.test.ts` (or similar) covering: default-row emission, projection math, category grouping order, and storage cost calculations.
- [ ] Write snapshot/DOM tests for the accordion component (e.g., `tests/unit/app/dashboard/usage/accordion.test.tsx`) to ensure empty states, projection chips, and tooltips render as expected.
- [ ] Extend an E2E/Playwright spec (`tests/e2e/usage-dashboard.spec.ts`) that logs in, toggles date ranges, expands/collapses all categories, verifies tooltip accessibility, and checks responsive breakpoints.
- [ ] Follow the manual QA checklist from the plan: compare seeded data vs. dashboard totals, test light/dark themes, confirm `$5/$20/$100` projections for each action, and run through screen-reader navigation before sign-off.
