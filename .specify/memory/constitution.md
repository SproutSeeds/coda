<!--
Sync Impact Report
Version change: none → 1.0.0
Modified principles: Initial issuance
Added sections: Core Principles; Operational Mandates; Delivery Workflow; Governance
Removed sections: None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md (Constitution Check + structure updated)
- ✅ .specify/templates/spec-template.md (constitution guardrails integrated)
- ✅ .specify/templates/tasks-template.md (Next.js stack workflow enforced)
- ✅ .specify/templates/commands (directory absent; no updates required)
Follow-up TODOs:
- TODO(RATIFICATION_DATE): Capture original adoption date once confirmed.
-->
# Coda Platform / Ideas Engine Constitution

## Core Principles

### I. Fast Iteration with Premium Experience
- Every push MUST trigger a Vercel Preview deployment; merges to `main` MUST deploy to Production automatically.
- The experience MUST meet the performance budget of LCP < 2.5s and CLS ≈ 0 on a mid-tier device.
- Motion and interactions MUST use Framer Motion with transform/opacity transitions targeting 150–200 ms micro-interactions.
Rationale: Continuous delivery with premium UX is the project’s competitive edge; it enforces the priorities in the TSDR Overview.

### II. Canonical Next.js Stack Only
- Next.js (App Router) with strict TypeScript is the sole runtime; deviations require a documented amendment.
- Rendering MUST use RSC + SSR/SSG; mutations MUST flow through Server Actions unless a documented exception exists.
- Tailwind CSS with shadcn/ui primitives and lucide-react icons MUST be the design system foundation.
- PostgreSQL via Drizzle ORM + Drizzle Kit migrations is mandatory; drizzle-zod MUST generate validation schemas.
Rationale: A single, enforced stack avoids lock-in drift and keeps platform velocity high.

### III. Repository Discipline & Tooling
- The repository MUST follow the mandated structure (`app/`, `components/`, `lib/…`, `public/`, `styles/`, `scripts/`).
- TypeScript config MUST enable `strict: true` and the `@/*` path alias.
- Prettier MUST include `prettier-plugin-tailwindcss` and `@ianvs/prettier-plugin-sort-imports`; import order MUST match React/Next → third-party → `@/*` → relative.
- Work MUST follow trunk-based flow: feature branches (`feat/*`) → PR → merge when CI + Vercel Preview are green.
Rationale: Consistent structure and automation keep reviews fast and prevent regressions.

### IV. Environment Integrity & Automated Delivery
- Baseline env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`) MUST be defined across Vercel Production, Preview, and Development.
- `.env.local` MUST capture local secrets and MUST NOT be committed.
- Vercel Postgres integration MUST stay connected; migrations MUST run via postbuild Drizzle migrate in Production (guarded by `VERCEL_ENV === "production"`) or a documented manual run.
- Auth flows MUST use Auth.js (NextAuth) with Credentials + GitHub OAuth; passwords MUST hash with bcryptjs ≥ 12 rounds.
Rationale: Consistent environment management keeps deployments deterministic and secure.

### V. Quality, Observability & Definition of Done
- CI MUST include `pnpm typecheck`, `pnpm lint`, and `pnpm build`; failures block merges.
- Tests MUST use Vitest for units and Playwright for E2E once flows stabilize; suites MUST exist before implementation when practical (TDD bias).
- Every release MUST satisfy the Definition of Done: functional auth flows, Postgres connectivity, optimistic CRUD slice, motion polish <200 ms, green CI, Preview + Production deploys, Lighthouse ≥ 90 across categories.
- Vercel Analytics MUST remain enabled; Sentry and/or PostHog SHOULD be activated when telemetry becomes necessary.
Rationale: Enforced quality gates and telemetry protect the premium user promise.

## Operational Mandates

**Stack Enforcement**  
- Next.js App Router with Server Actions is mandatory for feature delivery.  
- Server components SHOULD default to Node runtime; Edge runtime is only allowed for stateless, database-free routes with documented justification.

**Data & Validation**  
- PostgreSQL is the canonical data store; Neon Serverless is permitted only when multi-region or HTTP driver needs are documented.  
- All data models MUST flow through Drizzle ORM with migrations tracked in `lib/db/`.  
- Runtime validation MUST use Zod, generated via drizzle-zod where possible to prevent schema drift.

**Styling & Motion**  
- Tailwind configuration lives in `styles/`; shadcn/ui components MUST remain copy-owned within `components/`.  
- Framer Motion transitions MUST minimize layout thrash and rely on transform/opacity.

**Security & Accessibility**  
- Rate limiting MUST protect auth endpoints using Vercel middleware or equivalent.  
- Secrets MUST never leak to the client bundle.  
- Components MUST meet WCAG AA contrast and expose focus states with appropriate ARIA attributes.

**Performance Guardrails**  
- Bundle size MUST stay minimal by preferring RSC + Server Actions; client-only libraries REQUIRE documented justification.  
- CLS regressions MUST trigger remediation before release.

## Delivery Workflow & Definition of Done

1. Connect GitHub repository to Vercel with Production branch `main`.  
2. Ensure CI (`.github/workflows/ci.yml`) runs on pull requests with typecheck, lint, and build steps using Node 20 and pnpm 9+.  
3. On every push, Vercel MUST produce a Preview URL; merges to `main` MUST auto-deploy to Production.  
4. Run Drizzle migrations using the postbuild script in Production or the approved manual Drizzle CLI flow.  
5. Confirm Definition of Done items before sign-off:  
   - Auth.js credentials + GitHub OAuth flows succeed end-to-end.  
   - Database connectivity and migrations succeed in Preview and Production.  
   - CRUD demo slice (Ideas) ships with optimistic UX backed by Server Actions + Zod validation.  
   - Motion polish meets duration requirements and feels premium.  
   - Lighthouse smoke scores ≥ 90 for Performance, Best Practices, SEO, and Accessibility.

## Governance

- **Authority**: This constitution supersedes conflicting guidance; the Tech Stack Decision Record remains the source of truth for mandates referenced here.  
- **Amendments**: Proposals MUST document rationale, stack impact, migration path, and associated template changes. Amendments require project lead approval and update of this document plus dependent templates.  
- **Versioning**: Apply semantic versioning. MAJOR for breaking or removing principles; MINOR for new sections or expanded mandates; PATCH for clarifications.  
- **Compliance Reviews**: Constitution compliance MUST be checked at plan kickoff, pre-implementation, and pre-release. Violations require documented mitigations in Complexity Tracking.  
- **Stack Exceptions**: Allowed variations (Neon, Clerk, tRPC, Sentry/PostHog) MUST include justification and remain auditable within plan/spec/tasks outputs.  
- **Record Keeping**: Sync Impact Report MUST list downstream templates touched; TODO items MUST be resolved in the next amendment.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): Provide original adoption date once available. | **Last Amended**: 2025-10-04
