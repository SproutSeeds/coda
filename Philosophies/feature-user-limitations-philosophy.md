---
doc: philosophy
id: feature-user-limitations
planRef: Plans/feature-user-limitations.md
planVersion: 1.0.0
lastReviewed: 2025-11-05
reviewCadence: monthly
---

# Feature User Limitations — Philosophy

Companion to: ../Plans/feature-user-limitations.md

This document captures the product and engineering philosophy guiding how we limit database usage across users, ideas, and teams. It explains why limits exist, how we want them to feel, and the architectural principles we follow when enforcing them.

## What Exists Today (Snapshot)
- Rate limiting: Upstash Redis rate limiters protect several server actions (e.g., share, join, and other mutation endpoints) to prevent bursts and abuse.
- Permissions first: Editing rights derive from ownership/admin or explicit collaborator membership; viewers of public ideas are read‑only and can request access (Join Forces).
- Join Forces requests: View‑only users can submit a request to join an idea’s team; requests are stored and deduplicated at submission time, with plans to expose owner review tools and approval → collaborator creation.
- Public vs private visibility: UI and search support visibility filtering; public content is readable by anyone, private content by members only.
- Auth‑gated actions: Certain actions (e.g., Meetup check‑in) require sign‑in before persistence, avoiding ghost rows for anonymous users.

These foundations already signal our bias for reliability, clarity, and explicit role boundaries. The quota/usage model extends the same product feel across growth and cost control.

## Product Principles
- User‑first guardrails: Limits should protect the system without surprising users. Clear messages explain the limit, current usage, and what to do next.
- Predictable friction: Prefer soft warnings before hard blocks when feasible. Soft overages should not corrupt data or leave users stuck mid‑flow.
- Upgrade paths, not dead ends: When we block, present a concrete next step (upgrade, request an override, or reduce scope) instead of an opaque error.
- Respect intention: If a user initiates a single action that expands into multiple writes (e.g., import), treat it as one intention and fail fast before partial work.
- Least privilege by default: Viewers can discover and learn; editing requires explicit membership or approval. Limits never expand permissions.
- Don’t break reading: Hitting limits must not degrade existing read paths for the user or their collaborators.
- Usage owns the truth: Every account sees a live usage dashboard showing raw cost, credits remaining, and projections, so no one wonders “what will I owe?”
- Credits, not guesses: We sell prepaid credits covering real vendor costs (with safety buffer). Users can bank them, see each deduction, and pause or refuel whenever they want.
- Fuel versus features: Plan fees cover service value (templates, Dev Mode orchestration, support); credits cover raw cloud spend so pricing feels honest.

## Engineering Principles
- Centralized policy: A single guard module resolves effective limits and makes allow/warn/block decisions. No ad‑hoc checks sprinkled across code.
- Transactional integrity: If an action is allowed, we increment usage in the same DB transaction as the business write. Either both happen or neither.
- Deterministic outcomes: The same inputs lead to the same decision; no hidden state machines. All decisions are auditable.
- Performance first: Policy resolution and counter reads are O(1) lookups with light caching. No heavy joins on hot paths.
- Observability: Every warn/block emits structured analytics and optional logs for triage and tuning. Owners can see why something was blocked.
- Resilient by default: If non‑critical subsystems (e.g., Redis) are down, the system fails safe in a way that preserves data integrity and clear UX.
- Idempotence: Server actions that can be retried should not double‑count or double‑write.

## Scope & Vocabulary
- Metrics namespace: We use a canonical metric naming scheme (e.g., `ideas.per_user.lifetime`, `features.per_idea.lifetime`).
- Periods: lifetime, daily, monthly. Counters record both point‑in‑time usage and sliding windows via Redis when needed.
- Limits: soft and hard thresholds. Soft triggers warnings; hard blocks writes.
- Cool‑downs: Time‑based backoffs to prevent spammy, low‑cost actions (e.g., repeat join requests).

## Decision Order
1. Rate limit and cool‑down checks (cheap and fast, often Redis‑backed).
2. Permission and visibility checks (authoritative gate on who can act).
3. Quota evaluation (read counters and policy; decide allow/warn/block).
4. Execute business logic within a DB transaction, incrementing usage if allowed.

Rationale: Keep hot paths cheap, avoid leaking entity existence via limits, and guarantee simple mental models (if you aren’t allowed to perform the action, limits are irrelevant).

## User Experience
- Pre‑emptive awareness: Surfaces in Account/Idea screens show remaining capacity so users can plan.
- On warn: Non‑blocking toast and subtle indicators; never leave the UI in a half‑finished state.
- On block: A focused dialog explains the metric, current usage, and options (upgrade, request override, or clean up). Close returns the UI to a safe state.
- Accessibility: All messaging respects reduced motion, uses semantic roles, and remains readable in high‑contrast themes.

## Ownership, Overrides, and Fairness
- Owner empowerment: Owners/admins can review Join Forces requests and explicitly grant edit rights. Limits don’t bypass ownership.
- Exceptions with a paper trail: Admin overrides are explicit, time‑boxed, and auditable (who, why, when).
- Fair resource sharing: Defaults favor Free plan viability without degrading paying tenants.

## Data Integrity & Reconciliation
- Counters are fast and approximate in real time but reconciled regularly from authoritative tables to correct drift.
- Actions are designed to be replay‑safe; reconciliation never amplifies or erases valid work.

## Security & Privacy
- Decisions never reveal private entity details to unauthorized users.
- Limit and usage data is scoped to the viewer’s rights and is not leaked across orgs/users.

## Rollout Philosophy
- Monitor → Warn → Block. We always start with visibility (no enforcement), then gentle pressure, then hard enforcement where it makes sense.
- Progressive tuning: Metrics are feature‑flagged or config‑driven so we can iterate without redeploys.

## How This Ties to the Plan
- The guard, counters, overrides, and admin UX in the plan operationalize these principles.
- Existing rate limiting and permission models already reflect the direction we want: clear boundaries, safe defaults, and observable behavior.

## Living Document
This philosophy should evolve with pricing, platform scale, and user feedback. Propose changes via PRs alongside updates to ../Plans/feature-user-limitations.md.

## Feedback Loop & Update Protocol
- Triggers
  - Plan doc changes (frontmatter `version` bump or meaningful content diffs)
  - Post‑incident or limit false‑positive/negative review
  - Monthly cadence (`reviewCadence: monthly`) doc day
- Process
  - Open PR labeled `philosophy-update` that:
    - Updates this doc’s `planVersion` to match the plan’s `version`
    - Refreshes `lastReviewed` to the PR date
    - Summarizes what changed in the plan and why it matters philosophically
  - Required reviewers: Product + Eng + (optional) Design for UX frames
  - Merge gates: CI `doc:check-sync` passes, and owners approve
- Accountability
  - DRI: the feature owner for the plan; backup: platform lead
  - Analytics owner ensures any new limit events are captured/alerted

## Plan‑Aligned Addenda (v1.0.0)
The current plan introduces four notable areas that guide philosophy:

- Overrides with audit: We explicitly prefer time‑boxed overrides with a clear “why” over silent configuration changes. Exceptions should reinforce fairness and traceability, not circumvent policy.
- Nightly reconciliation: Real‑time counters are performance‑optimized but approximate; we value correctness over time by reconciling to the source of truth regularly.
- Central guard decisions: All allow/warn/block logic flows through a single module. This keeps decisions consistent and debuggable, which is critical for user trust.
- User‑visible usage: Transparent usage surfaces help users self‑manage against limits. We prefer proactive clarity over reactive blocks.
- Join Forces cool‑down: We trade immediacy for signal quality—cool‑downs reduce spam and respect owner attention while preserving a path to collaboration.
- Global mutation budgets: We favor proportional fairness under bursty workloads by budgeting daily mutations per user, rather than hard‑coding per‑action ceilings.
- Pay your own Dev Mode: The collaborator who spins up compute bears the cost unless the workspace explicitly sponsors them. Responsibility follows agency.
- Owner-funded pools: When owners choose to underwrite community usage, we make that opt-in, auditable, and capped so generosity doesn’t become silent liability.
- Cost pass-through: Usage charges mirror our vendor invoices; plans charge for service value (templates, orchestration, support). Users should see the raw numbers.
