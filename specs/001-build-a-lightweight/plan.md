# Implementation Plan: IdeaVault MVP

**Branch**: `001-build-a-lightweight` | **Date**: 2025-10-04 | **Spec**: [/Users/codymitchell/Documents/code/coda/specs/001-build-a-lightweight/spec.md](/Users/codymitchell/Documents/code/coda/specs/001-build-a-lightweight/spec.md)
**Input**: Feature specification from `/specs/001-build-a-lightweight/spec.md`

## Summary
Deliver IdeaVault, a personal idea management surface for authenticated users, with create/edit/delete workflows, keyword search, undo safety net, and polished motion. Implementation will extend the Next.js App Router stack mandated in the constitution, persist ideas in PostgreSQL via Drizzle, and ensure performance targets (TTI ≤2.0s, Lighthouse ≥90) while instrumenting analytics and rate limiting.

## Technical Context
**Language/Version**: TypeScript 5.x with Next.js App Router (Node runtime)  
**Primary Dependencies**: Next.js, React Server Components + Server Actions, Tailwind CSS, shadcn/ui, lucide-react, Framer Motion, Drizzle ORM + Drizzle Kit, drizzle-zod, Zod, Auth.js (Credentials + GitHub OAuth)  
**Storage**: PostgreSQL (Vercel Postgres primary, Neon allowed for local/preview) with Drizzle-managed migrations  
**Testing**: Vitest (unit), Playwright (e2e), Lighthouse CI smoke, pnpm lint/typecheck/build gates  
**Target Platform**: Vercel-hosted web application with Preview per push and Production on main merges  
**Project Type**: Web (single Next.js project using mandated `app/` structure)  
**Performance Goals**: TTI ≤2.0s on mid-tier 4G, LCP <2.5s, CLS ≈0, server actions ≤400 ms p95, animations ≤200 ms, Lighthouse ≥90 across categories  
**Constraints**: Auth.js session protection, sanitized Markdown notes (CommonMark subset), title length ≤ 200 chars, undo window 10 s with 30-day purge, prefers-reduced-motion support, Upstash Redis rate limiting (sliding window), secrets isolated via env vars, postbuild Drizzle migrate in production  
**Scale/Scope**: Designed for single-tenant usage with ~1,000 ideas per user and initial cohort of ≤10k monthly active users; soft-deletion retention 30 days pending confirmation

## Constitution Check
- **Stack Alignment**: PASS — Plan uses Next.js App Router, strict TypeScript, Tailwind + shadcn/ui, lucide-react icons, Server Actions for mutations.  
- **Data & Validation**: PASS — PostgreSQL via Drizzle ORM/Kit with drizzle-zod-generated schemas and Zod validation for API inputs.  
- **Deployment**: PASS — Workflows sustain GitHub Actions (lint/typecheck/build) and Vercel Preview on pushes, Production on main with postbuild Drizzle migrate guarded by `VERCEL_ENV`.  
- **Environment & Security**: PASS — Baseline env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`) tracked; bcrypt ≥12 for credentials; rate limiting for auth + idea endpoints; secrets remain server-side.  
- **Quality Gates**: PASS — Plan expands Vitest + Playwright coverage, pnpm commands enforced in CI, observability hooks defined.  
- **Definition of Done**: PASS — Auth flows, optimistic CRUD slice, motion polish, Lighthouse ≥90, analytics enabled per Definition of Done.  
- **Performance & Accessibility**: PASS — RSC-first design, transform/opacity motions capped at 200 ms, WCAG AA focus/contrast, reduce-motion handling.  
- **Exceptions**: None requested; Neon allowed only for local tooling if needed.

## Project Structure

### Documentation (this feature)
```
specs/001-build-a-lightweight/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── ideas-create.md
    ├── ideas-edit.md
    ├── ideas-list.md
    ├── ideas-search.md
    ├── ideas-delete.md
    └── ideas-restore.md
```

### Source Code (repository root)
```
app/
├── (auth)/sign-in/page.tsx                # existing auth flow
├── (authenticated)/ideas/
│   ├── page.tsx                           # ideas list + search
│   ├── new/route.ts                       # Server Action endpoint for create
│   ├── edit/[id]/route.ts                 # Server Action for edit
│   └── api/
│       ├── route.ts                       # REST proxy if needed
│       └── search/route.ts                # search endpoint
components/
├── ideas/
│   ├── IdeaCard.tsx
│   ├── IdeaComposer.tsx
│   └── EmptyState.tsx
lib/
├── auth/
├── db/
│   ├── schema/
│   │   └── ideas.ts
│   └── migrations/
├── validations/
│   └── ideas.ts
└── utils/
    ├── rate-limit.ts
    └── analytics.ts
public/
styles/
scripts/
```

**Structure Decision**: Extend core Next.js app with authenticated `app/(authenticated)/ideas` route grouping, using Server Actions for create/edit/delete while REST endpoints back Playwright and contract tests. Shared UI lives under `components/ideas`, Drizzle schema under `lib/db/schema`, validations in `lib/validations`, analytics helpers in `lib/utils`.

## Phase 0: Outline & Research
Research backlog is resolved and captured in [`research.md`](./research.md). Key decisions locked for implementation:
- Notes use sanitized Markdown (CommonMark subset rendered via `rehype-sanitize`), stored as text with server-side cleaning.
- Soft delete maintains `deleted_at`, `undo_token`, `undo_expires_at`; a Vercel Cron job performs 30-day hard purge.
- Search leverages Postgres `pg_trgm` GIN indexes for substring matching with cursor pagination; fallback `ILIKE` reserved for diagnostics.
- Motion tokens: Framer Motion `easeOut` animations at 180 ms (enter) / 160 ms (exit) with fade-only behavior for `prefers-reduced-motion`.
- Analytics limited to aggregated Vercel Analytics events (`idea_created`, `idea_edited`, `idea_deleted`, `idea_restored`, `idea_searched`); audit table disabled by default.
- Rate limiting uses Upstash Redis (`@upstash/ratelimit`) sliding window with per-user limits (create/delete 60/min, edit/restore 120/min, list 300/min, search 120/min).

Any future research adjustments must update both `research.md` and dependent artifacts before `/tasks`.

## Phase 1: Design & Contracts
1. **Data Model (`data-model.md`)**:
   - Document `ideas` table with sanitized Markdown notes, title length ≤ 200 chars, default timestamps, and mandatory soft-delete fields (`deleted_at`, `undo_token`, `undo_expires_at`).
   - Describe optional `idea_search_audit` table kept disabled by default, including privacy and retention notes.
   - Define indexes (`created_at` desc, `pg_trgm` on title/notes, partial active filter) and ownership constraints.
   - Record undo retention workflow (10 s window, Vercel Cron purge after 30 days).

2. **API & Server Actions (`contracts/`)**:
   - `ideas-create.md`: POST /api/ideas & Server Action contract enforcing title ≤ 200 chars, sanitized Markdown notes, rate-limit headers, and success payload.
   - `ideas-edit.md`: PATCH /api/ideas/{id}` contract capturing partial updates, optimistic concurrency check, and analytics event emission.
   - `ideas-list.md`: GET /api/ideas with cursor pagination, active-only filter, and empty-state semantics.
   - `ideas-search.md`: GET /api/ideas/search using trigram index assumptions, highlight rules, and result limits.
   - `ideas-delete.md`: DELETE /api/ideas/{id} returning undo token, expiry timestamp, and purge policy messaging.
   - `ideas-restore.md`: POST /api/ideas/{id}/restore validating undo token, expiry handling, and telemetry.
   - Each file must enumerate auth requirements, error codes, response schema, and analytics hooks.

3. **Validation Schemas**:
   - Build Zod schema for idea create/edit aligning with length limits and sanitized notes.
   - Derive `drizzle-zod` to ensure DB + runtime parity.

4. **UX & Interaction**:
   - Document composer component states (draft/submit/error), list virtualization plan, animation sequences.
   - Map empty/loading/error/resolved flows for list and search.
   - Outline accessibility behaviors (keyboard shortcuts, aria-live toasts).

5. **Testing Blueprint**:
   - Identify unit tests (validation, search util, undo timer), integration tests (Playwright flows), contract tests (Server Actions/REST), performance budgets (Lighthouse script).

6. **Agent Context**:
   - Run `.specify/scripts/bash/update-agent-context.sh codex` after Phase 1 docs to update active technologies.

7. **Deliverables**: Completed `data-model.md`, `contracts/*`, `quickstart.md` (with runbooks), updated agent context file, and plan updates capturing design rationale.

## Phase 2: Task Planning Approach
**Task Generation Strategy**:
- `/tasks` will read this plan plus Phase 1 artifacts to enumerate tasks: setup (schema, env vars), TDD (Vitest contract/unit tests, Playwright flows), implementation (Server Actions, UI components), integration (analytics, rate limiting), polish (motion tuning, Lighthouse, accessibility).
- Each contract file → corresponding test + implementation tasks; each entity → schema + migration tasks; each UX flow → Playwright scenario.
- Include tasks for background retention job, undo snackbar instrumentation, analytics event emission, and reduce-motion verification.

**Ordering Strategy**:
1. Bootstrap schema + env config.  
2. Author tests first: validation units, contract tests, Playwright flows, Lighthouse budgets.  
3. Implement Drizzle schema + migrations, then Server Actions (create/edit/delete/restore), then UI components.  
4. Integrate rate limiting, analytics, undo retention, and telemetry hooks.  
5. Finish with motion polish, accessibility QA, docs updates.

**Estimated Output**: ~28 tasks covering setup, testing, implementation, and polish stages with `[P]` on independent files (e.g., parallel contract tests, UI components).

## Phase 3+: Future Implementation
Execution will follow tasks.md once generated, culminating in validation (pnpm test/lint/build, Lighthouse, manual QA) prior to release.

## Complexity Tracking
*No constitutional deviations identified; table intentionally left empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
