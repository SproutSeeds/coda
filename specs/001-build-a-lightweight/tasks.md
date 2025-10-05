# Tasks: IdeaVault MVP

**Input**: Design documents from `/specs/001-build-a-lightweight/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan, research, data-model, contracts, quickstart documents
2. Confirm constitution alignment for stack, data, testing, deployment
3. Generate dependency-ordered tasks across setup → tests → implementation → integration → polish
4. Mark [P] for tasks touching disjoint files or independent concerns
5. Validate that contract tests precede implementation and that all Definition of Done criteria are covered
```

## Phase 3.1: Setup
- [X] T001 Configure environment secrets (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GITHUB_ID/GITHUB_SECRET, UPSTASH_REDIS variables) in `.env.local` and Vercel project according to quickstart.md. *(no [P]; shared env config — placeholders added locally; Vercel deployment requires manual update)*
- [ ] T002 Install/confirm dependencies (`pnpm install`), add `@upstash/ratelimit`, `rehype-sanitize`, and ensure ESLint/Prettier plugins are configured per constitution. *(no [P]; affects shared tooling)*
- [ ] T003 Initialize Drizzle migration for `ideas` table and optional cron metadata files (`pnpm drizzle-kit generate`). *(no [P]; migration skeleton needed before tests)*

## Phase 3.2: Tests First (TDD)
- [ ] T004 [P] Write Vitest unit tests for idea validation schemas in `tests/unit/ideas-validation.test.ts` (title ≤200 chars, Markdown sanitization). 
- [ ] T005 [P] Write Vitest unit tests for undo token lifecycle utilities in `tests/unit/undo-lifecycle.test.ts`. 
- [ ] T006 [P] Write contract tests for `POST /api/ideas` in `tests/contract/ideas-create.test.ts` using Supertest (201 success, validation 400, rate limit 429). 
- [ ] T007 [P] Write contract tests for `PATCH /api/ideas/{id}` in `tests/contract/ideas-edit.test.ts` (conflict 409, ownership 403, success). 
- [ ] T008 [P] Write contract tests for `GET /api/ideas` in `tests/contract/ideas-list.test.ts` (pagination, empty state). 
- [ ] T009 [P] Write contract tests for `GET /api/ideas/search` in `tests/contract/ideas-search.test.ts` (trigram matching, rate limit). 
- [ ] T010 [P] Write contract tests for `DELETE /api/ideas/{id}` in `tests/contract/ideas-delete.test.ts` (undo token, already deleted). 
- [ ] T011 [P] Write contract tests for `POST /api/ideas/{id}/restore` in `tests/contract/ideas-restore.test.ts` (valid token, expired token 410). 
- [ ] T012 [P] Author Playwright e2e scenario for idea CRUD flow in `tests/e2e/ideas-crud.spec.ts` (create → edit → search → delete → undo). 
- [ ] T013 [P] Author Playwright e2e scenario for empty state and search zero results in `tests/e2e/ideas-empty-search.spec.ts`. 
- [ ] T014 [P] Add Lighthouse CI smoke test script in `tests/perf/ideas-lighthouse.mjs` enforcing ≥90 scores. 

## Phase 3.3: Core Implementation
- [ ] T015 Implement Drizzle schema and migration for `ideas` table in `lib/db/schema/ideas.ts` and `/drizzle/migrations/*` (UUID PK, sanitized Markdown notes, soft delete fields, trigram index). *(no [P]; foundational schema)*
- [ ] T016 Implement undo retention cron script in `scripts/purge-soft-deleted-ideas.ts` with Vercel Cron configuration. *(no [P]; single script)*
- [ ] T017 Implement Zod validation schemas in `lib/validations/ideas.ts` leveraging drizzle-zod and Markdown sanitizer. *(no [P]; referenced across actions)*
- [ ] T018 Implement Upstash rate limiter helper in `lib/utils/rate-limit.ts` and unit-tested hooks. *(no [P]; shared utility)*
- [ ] T019 Implement analytics helper in `lib/utils/analytics.ts` emitting Vercel Analytics events for idea actions. *(no [P]; shared utility)*
- [ ] T020 Implement `createIdeaAction` Server Action and REST handler in `app/(authenticated)/ideas/new/route.ts` + `app/(authenticated)/ideas/api/route.ts`. *(no [P]; shared files)*
- [ ] T021 Implement `updateIdeaAction` in `app/(authenticated)/ideas/edit/[id]/route.ts` respecting optimistic concurrency. *(no [P]; same module family)*
- [ ] T022 Implement `listIdeasAction` and page loader in `app/(authenticated)/ideas/page.tsx` with cursor pagination and empty state. *(no [P])* 
- [ ] T023 Implement `searchIdeasAction` in `app/(authenticated)/ideas/api/search/route.ts` using trigram search. *(no [P])* 
- [ ] T024 Implement `deleteIdeaAction` and `restoreIdeaAction` within `app/(authenticated)/ideas/api/route.ts` for undo lifecycle. *(no [P])* 
- [ ] T025 Build `IdeaComposer` component in `components/ideas/IdeaComposer.tsx` with Markdown editor, validation errors, and reduce-motion support. *(no [P])*
- [ ] T026 Build `IdeaCard` component in `components/ideas/IdeaCard.tsx` with Framer Motion enter/exit animations and action menu. *(no [P])*
- [ ] T027 Build `EmptyState` and search result components in `components/ideas/EmptyState.tsx` and `components/ideas/SearchResults.tsx`. *(no [P])* 
- [ ] T028 Implement optimistic UI updates for create/edit/delete in `app/(authenticated)/ideas/page.tsx` using Server Action responses. *(no [P])*

## Phase 3.4: Integration
- [ ] T029 Configure rate limiting middleware wiring in `middleware.ts` or route handlers, ensuring limits per contract. *(no [P])* 
- [ ] T030 Integrate analytics hooks into Server Actions (create/edit/delete/restore/search) emitting events via helper. *(no [P])* 
- [ ] T031 Add undo snackbar UX with 10 s countdown and restore wiring in `app/(authenticated)/ideas/page.tsx`. *(no [P])* 
- [ ] T032 Wire Vercel Cron job deployment configuration (vercel.json) to run purge script daily. *(no [P])* 
- [ ] T033 Update Auth.js session enforcement for ideas routes ensuring redirect for unauthenticated access in `middleware.ts` / route groups. *(no [P])*
- [ ] T034 Document manual QA checklist outcomes in `specs/001-build-a-lightweight/quickstart.md` (mark items as implemented). *(no [P])*

## Phase 3.5: Polish
- [ ] T035 [P] Tune Framer Motion tokens and verify prefers-reduced-motion behavior; record results in `specs/.../quickstart.md` QA section. 
- [ ] T036 [P] Run and fix `pnpm lint`, `pnpm typecheck`, and `pnpm test` pipelines; update CI config if new scripts added. 
- [ ] T037 [P] Execute Playwright and Lighthouse suites; attach evidence/screenshots to project documentation. 
- [ ] T038 [P] Update docs: add IdeaVault section to README (if required) and ensure `AGENTS.md` recent changes reflect implementation details. 
- [ ] T039 [P] Final verification: run `pnpm build` and deploy to Vercel Preview, validate undo cron entry, and sign off readiness for production rollout. 

## Dependencies
- T001 → T002 → T003 → Tests (T004-T014) → Implementation (T015-T028) → Integration (T029-T034) → Polish (T035-T039).
- Contract tests (T006-T011) must pass before implementing corresponding actions (T020-T024).
- Schema (T015) blocks Server Actions and migrations.
- Rate limiter helper (T018) required before wiring in T029.

## Parallel Execution Examples
```
# After setup completes:
tasks launch T004 T005 T006 T007  # run unit + contract tests in parallel

tasks launch T012 T013 T014      # execute e2e + perf test authoring concurrently

# During polish phase:
tasks launch T035 T036 T037      # motion tuning, pipelines, and test execution in parallel
```

## Notes
- Tests precede implementation per TDD; do not start T015-T028 until T004-T014 exist and fail appropriately.
- Avoid [P] on tasks touching shared files to prevent merge conflicts.
- Ensure all analytics and rate limiting code adheres to constitution mandates (no secrets client-side, events anonymized).
- Document any deviations in Complexity Tracking if new constraints emerge.
