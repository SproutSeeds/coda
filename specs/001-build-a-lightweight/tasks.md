# Tasks: Coda MVP

**Input**: Design documents from `specs/001-build-a-lightweight/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Validate G0 scaffold gate (T000) before any feature work.
2. Read plan.md, research.md, data-model.md, contracts/, quickstart.md to extract stack, entities, endpoints, QA gates.
3. Generate dependency-ordered tasks: Setup → Tests (TDD) → Core implementation → Integration → Polish.
4. Mark [P] only when work touches disjoint files and has no dependency chain.
5. Ensure every Server Action/API contract has a failing test before implementation.
6. Confirm Definition of Done: undo flow, trigram search, motion polish, analytics, CI pipelines.
```

## Phase 3.0: Gate G0 – Scaffold (must pass before anything else)
- [X] T000 Run the scaffold commands from plan.md to initialize/refresh the Next.js App Router project and mark completion:
  - `git rev-parse --is-inside-work-tree || git init`
  - `pnpm dlx create-next-app@latest . --ts --app --use-pnpm --eslint --tailwind --import-alias "@/*"`
  - `pnpm add framer-motion lucide-react clsx tailwind-merge class-variance-authority`
  - `pnpm dlx shadcn@latest init && pnpm dlx shadcn@latest add button input textarea card label form toast separator`
  - `pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit`
  - `pnpm add zod drizzle-zod`
  - `pnpm add next-auth bcryptjs @upstash/ratelimit @upstash/redis rehype-sanitize @vercel/analytics`
  - Create baseline `lib/{db,auth,validations,utils}`, `scripts`, `tests/{unit,e2e,contract,perf}` directories
  - Add minimal `drizzle.config.ts`, `lib/db/schema.ts`
  - Touch `.specify/memory/scaffold.ok` to unblock `/tasks`
  - Re-run `.specify/scripts/bash/update-agent-context.sh codex`

## Phase 3.1: Setup
- [X] T001 Populate `.env.example` and `.env.local` with placeholders for `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VERCEL_ANALYTICS_ID`, and email delivery settings; document sourcing steps in quickstart.
- [X] T002 Align `package.json` scripts (`db:generate`, `db:migrate`, `test`, `e2e`, `lighthouse`, `lint`, `typecheck`) and add drizzling scripts plus Playwright/Lighthouse runners.
- [X] T003 Configure `drizzle.config.ts` and `lib/db/index.ts` to point at Postgres using env vars; stub migration folder and update README quickstart snippets.
- [X] T004 Seed testing utilities: create `tests/setup/test-env.ts` with database reset + Auth.js session helpers; ensure Vitest picks it up via config.

## Phase 3.2: Tests First (TDD – must exist and fail before Phase 3.3)
- [X] T005 [P] Add Vitest suite for idea validation schemas in `tests/unit/ideas-validation.test.ts` (title length, Markdown sanitization, notes required).
- [X] T006 [P] Add Vitest suite for undo lifecycle helpers in `tests/unit/undo-lifecycle.test.ts` (token generation, expiry logic, purge behaviour).
- [X] T007 [P] Add Vitest suite for rate limiting helper in `tests/unit/rate-limit.test.ts` (per-user windows, redis fallback, error cases).
- [X] T008 [P] Add Vitest suite for analytics helper in `tests/unit/analytics-events.test.ts` ensuring required events fire with metadata.
- [X] T009 [P] Create contract tests for `createIdea` Server Action in `tests/contract/ideas-create.test.ts` (201 success, validation 400, rate limit 429).
- [X] T010 [P] Create contract tests for `updateIdea` in `tests/contract/ideas-update.test.ts` (ownership 403, conflict 409, success path).
- [X] T011 [P] Create contract tests for `listIdeas` in `tests/contract/ideas-list.test.ts` (pagination, empty list, ordering).
- [X] T012 [P] Create contract tests for `searchIdeas` in `tests/contract/ideas-search.test.ts` (trigram match, zero results, rate limit).
- [X] T013 [P] Create contract tests for `deleteIdea` and `restoreIdea` in `tests/contract/ideas-undo.test.ts` (undo token returned, expired token 410, cascade).
- [X] T014 [P] Author Playwright CRUD journey in `tests/e2e/ideas-crud.spec.ts` (login, create, edit, search, delete, undo).
- [X] T015 [P] Author Playwright search/empty state scenario in `tests/e2e/ideas-search-empty.spec.ts` (keyword filtering, empty states, latency guardrails).
- [X] T016 [P] Author Playwright access control scenario in `tests/e2e/ideas-auth.spec.ts` (anonymous redirect, session expiry).
- [X] T017 [P] Add Lighthouse budget harness in `tests/perf/ideas-lighthouse.mjs` enforcing ≥90 scores and <2.5 s LCP.

## Phase 3.3: Core Implementation (run only after T005–T017 fail)
- [X] T018 Implement Drizzle schema + initial migration for `ideas` table in `lib/db/schema/ideas.ts` and `drizzle/migrations/*` (UUID PK, soft delete fields, trigram index, undo columns).
- [X] T019 Implement optional `idea_search_audit` migration guarded by feature flag with retention policy comments.
- [X] T020 Implement Markdown sanitation + Zod validators in `lib/validations/ideas.ts` using drizzle-zod and `rehype-sanitize` helper from `lib/utils/markdown.ts`.
- [X] T021 Implement rate limiter helper in `lib/utils/rate-limit.ts` wrapping `@upstash/ratelimit` with per-user/session windows.
- [X] T022 Implement analytics helper in `lib/utils/analytics.ts` to emit `idea_*` events via Vercel Analytics with timing metadata.
- [X] T023 Implement undo lifecycle utilities in `lib/utils/undo.ts` (token generation, expiry checks, purge selectors) consumed by actions.
- [X] T024 Implement `createIdeaAction` Server Action + REST handler in `app/dashboard/ideas/actions/create.ts` and API route; wire validations, auth, rate limiting, analytics.
- [X] T025 Implement `updateIdeaAction` in `app/dashboard/ideas/actions/update.ts` plus route handler with concurrency and analytics logging.
- [X] T026 Implement `listIdeasAction` + loader in `app/dashboard/ideas/page.tsx` supporting cursor pagination and optimistic updates.
- [X] T027 Implement `searchIdeasAction` in `app/dashboard/ideas/actions/search.ts` hitting trigram index and returning typed results.
- [X] T028 Implement `deleteIdeaAction` + `restoreIdeaAction` in `app/dashboard/ideas/actions/delete.ts` with undo token hand-off.
- [X] T029 Build `components/ideas/IdeaComposer.tsx` (Markdown editor, validation errors, reduce-motion support).
- [X] T030 Build `components/ideas/IdeaCard.tsx` (Framer Motion enter/exit, action menu, analytics hooks).
- [X] T031 Build `components/ideas/IdeaList.tsx` & `components/ideas/SearchBar.tsx` for listing/search UI and zero states.
- [X] T032 Wire optimistic UI flows + suspense boundaries in `app/dashboard/ideas/page.tsx` including error/loading states.

## Phase 3.4: Integration & Observability
- [X] T033 Connect Upstash rate limiter to all Server Actions and REST routes; ensure middleware or per-action guard in `middleware.ts` / action wrappers.
- [X] T034 Integrate analytics helper into actions + UI events (create/edit/delete/restore/search) capturing latency and user metadata.
- [X] T035 Implement undo snackbar UX with 10 s countdown + restore trigger in `components/ideas/UndoSnackbar.tsx`; ensure a11y.
- [X] T036 Add Vercel Cron config (`vercel.json`) + `scripts/purge-soft-deleted-ideas.ts` to hard-delete rows older than 30 days.
- [X] T037 Enforce Auth.js session checks for ideas routes in `middleware.ts` and dedicated route groups (`(auth)` vs `(dashboard)`); redirect unauthenticated users to `/login`.
- [X] T038 Update `specs/001-build-a-lightweight/quickstart.md` with final runbooks (env sync, cron, analytics, manual QA results).
- [X] T039 Rerun `.specify/scripts/bash/update-agent-context.sh codex` to capture latest stack/command updates once implementation wiring is complete.

## Phase 3.5: Polish & Verification
- [ ] T040 [P] Tune Framer Motion tokens and prefers-reduced-motion fallbacks; record findings in quickstart QA section.
- [ ] T041 [P] Harden accessibility: run keyboard-only QA, ensure ARIA labels, focus management in `components/ideas/*`.
- [ ] T042 [P] Execute `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm lighthouse`; resolve failures and store evidence (artifacts/screenshots).
- [ ] T043 [P] Prepare CI updates if needed: ensure `.github/workflows/ci.yml` includes lint/typecheck/test/e2e/lighthouse jobs with caching.
- [ ] T044 [P] Deploy to Vercel Preview, validate undo cron, analytics dashboards, and document release/rollback steps in quickstart.
- [ ] T045 [P] Update root README and AGENTS instructions with Coda entry points and post-implementation notes.

## Phase 3.6: Email Magic-Link + Password Authentication
- [X] T046 Introduce Auth.js Drizzle adapter schema: add `users`, `accounts`, `sessions`, `verification_tokens` tables in `lib/db/schema.ts` and generate migration via `pnpm db:generate`; update data-model & plan with new entities.
- [X] T047 Apply the generated migration locally with `pnpm db:migrate` and document rollback instructions in `quickstart.md`; ensure database helpers are aware of the new tables.
- [ ] T048 [P] Author Vitest contract tests in `tests/contract/auth-email.test.ts` covering magic-link request (success, rate limit 429, unknown email), verification (valid token, expired token 410, reused token 409).
- [X] T049 [P] Add unit tests for email transport helper in `tests/unit/email-transport.test.ts` mocking provider SDK and ensuring templated subject/body.
- [X] T050 Implement Auth.js adapter wiring in `lib/auth/adapter.ts` using Drizzle; update `lib/auth/auth.ts` to register the Email provider gated by env vars and key admin privileges off `DEVELOPER_EMAIL`.
- [X] T051 Wire magic-link submission to NextAuth email provider (client `signIn('email')` + rate limit/analytics via provider hook); verification continues through NextAuth’s email callback.
- [X] T052 Extend `/login` UI to surface email magic-link + password forms with success/error states and drop the legacy owner-token shortcut.
- [X] T053 [P] Update Playwright suite with `tests/e2e/auth-email.spec.ts` simulating email flow via mock inbox (stream transport) and covering happy path, expired token, and rate limit messaging.
- [ ] T054 [P] Refresh existing Playwright specs to use shared auth helpers (`tests/e2e/utils/auth.ts`) and add coverage for password login success/failure paths.
- [X] T055 Add SMTP/email provider configuration: document `EMAIL_SERVER`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, optional provider tokens; update `.env.example`, README, deployment guide, and quickstart runbooks.
- [ ] T056 [P] Update CI and local scripts to load mail transport env vars (e.g., add `EMAIL_*` placeholders to CI secrets guidance) and confirm `pnpm test` passes with mocked transport.
- [X] T057 Ensure rate limiting + analytics cover email flow: update `lib/utils/rate-limit.ts` (if needed) and analytics helper to log `auth_magic_link_requested` / `auth_magic_link_verified`; add contract assertions.
- [X] T058 [P] Re-run `.specify/scripts/bash/update-agent-context.sh codex` to capture email-auth stack changes and append results to `AGENTS.md`.
- [ ] T059 Execute validation suite post-integration: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, `pnpm lighthouse`; attach evidence for new tests and ensure PROD env vars set in Vercel.

## Dependencies
- T000 blocks entire workflow (must create `.specify/memory/scaffold.ok`).
- T001–T004 depend on scaffold but precede all tests.
- Tests T005–T017 must complete before any implementation tasks T018–T032.
- T018 is prerequisite for T019–T028; T028 depends on T023.
- UI tasks T029–T032 depend on Server Actions and validators (T020–T028).
- Integration tasks T033–T039 depend on core implementations and utilities.
- Polish tasks T040–T045 depend on integration completion and test suites.

## Parallel Execution Examples
```
# After setup (T001–T004) completes and tests are ready to write:
tasks launch T005 T006 T007 T008  # parallel unit test authoring (different files)

tasks launch T009 T010 T011 T012 T013  # contract tests across distinct files

tasks launch T014 T015 T016 T017        # Playwright + Lighthouse harness in parallel

# During polish:
tasks launch T040 T041 T042             # motion tuning, accessibility pass, and pipeline run concurrently
```

## Notes
- Keep TDD discipline: do not start any implementation until contract/unit/e2e/perf tests exist and fail.
- Avoid marking `[P]` on tasks touching shared files (`plan.ts`, `page.tsx`, etc.) to reduce merge conflicts.
- Document any deviations or new constraints in the Complexity Tracking section of plan.md.
- Update quickstart and AGENTS.md as tasks dictate so agents stay aligned with the implementation state.
