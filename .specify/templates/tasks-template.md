# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: mandated stack choices, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model + validation tasks
   → contracts/: Each file → Server Action/API contract test task
   → research.md: Extract decisions → setup/compliance tasks
3. Generate tasks by category:
   → Setup: project structure, env vars, dependencies
   → Tests: Vitest unit, Playwright e2e, contract tests
   → Core: Drizzle models, Server Actions, Next.js routes/components
   → Integration: Auth.js flows, env wiring, migrations
   → Polish: motion, performance, analytics, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models + Zod schemas?
   → All Server Actions/routes implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Reference pnpm scripts when running commands

## Path Conventions
- Constitution-mandated structure:
  - `app/` (routes, layouts, server/client components)
  - `components/` (shadcn primitives + feature components)
  - `lib/auth/`, `lib/db/`, `lib/validations/`, `lib/utils/`
  - `public/`, `styles/`, `scripts/`
- Tests live in `tests/` (Vitest) and `tests/e2e/` (Playwright) unless plan specifies otherwise

## Phase 3.1: Setup
- [ ] T001 Verify Next.js App Router project configuration (`app/`, `tsconfig.json`) matches constitution
- [ ] T002 Ensure `pnpm` workspace dependencies for Tailwind, shadcn/ui, lucide-react are installed
- [ ] T003 [P] Confirm ESLint + Prettier config with Tailwind and import-sort plugins
- [ ] T004 [P] Seed `.env.local` template with required env vars (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GITHUB_ID, GITHUB_SECRET)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: Vitest/Playwright tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T005 [P] Create contract test for Server Action `[action name]` in `tests/contracts/[action].test.ts`
- [ ] T006 [P] Create Vitest unit tests for Drizzle model validators in `tests/unit/[entity].test.ts`
- [ ] T007 [P] Author Playwright scenario for primary user journey in `tests/e2e/ideas.spec.ts`
- [ ] T008 [P] Write Lighthouse budget test harness or acceptance checklist in `tests/perf/lighthouse.md`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T009 Implement Drizzle schema for `[Entity]` in `lib/db/schema/[entity].ts`
- [ ] T010 Generate Zod schema via drizzle-zod in `lib/validations/[entity].ts`
- [ ] T011 Build Server Action `[action name]` in `app/(routes)/[feature]/actions.ts`
- [ ] T012 Wire optimistic UI component in `app/(routes)/[feature]/page.tsx`
- [ ] T013 Implement Auth.js protected route middleware in `middleware.ts`
- [ ] T014 Configure Framer Motion transitions for `[feature]` components in `components/[feature]/motion.tsx`

## Phase 3.4: Integration
- [ ] T015 Apply Drizzle migration via `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
- [ ] T016 Connect Server Action to Auth.js session in `lib/auth/session.ts`
- [ ] T017 Ensure Vercel Analytics + optional Sentry/PostHog hooks in `lib/utils/analytics.ts`
- [ ] T018 Validate rate limiting middleware for auth endpoints in `middleware.ts`
- [ ] T019 Update CI workflow `.github/workflows/ci.yml` if new checks required

## Phase 3.5: Polish
- [ ] T020 [P] Refine Tailwind styles + accessibility states in `components/[feature]/` (focus rings, contrast)
- [ ] T021 [P] Confirm motion timings (150–200 ms) and CLS budget via visual QA checklist
- [ ] T022 Update developer quickstart docs in `specs/[###-feature]/quickstart.md`
- [ ] T023 Record deployment validation steps (Preview + Production) in `scripts/deploy-checklist.md`
- [ ] T024 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and record results

## Dependencies
- Tests (T005-T008) before implementation (T009-T014)
- T009 blocks T010 and T015
- T011 depends on T009/T010
- T013 depends on Auth.js research completion
- Implementation tasks must precede polish (T020-T024)

## Parallel Example
```
# Launch early TDD tasks together:
Task: "Contract test for Server Action [action] in tests/contracts/[action].test.ts"
Task: "Vitest unit tests for [entity] validators in tests/unit/[entity].test.ts"
Task: "Playwright primary journey in tests/e2e/ideas.spec.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing features
- Commit after each task cluster (setup, tests, implementation, polish)
- Flag constitution deviations explicitly in plan and Complexity Tracking

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each Server Action/API contract file → contract test task [P]
   - Each endpoint/Server Action → implementation task + validation task
   
2. **From Data Model**:
   - Each entity → Drizzle schema + Zod schema tasks [P]
   - Relationships → service layer or Server Action tasks
   
3. **From User Stories**:
   - Each story → Playwright scenario [P]
   - Quickstart scenarios → manual validation or script tasks

4. **Ordering**:
   - Setup → Tests → Models/Actions → UI → Integration → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities have Drizzle + Zod tasks
- [ ] Tests precede implementation
- [ ] Parallel tasks are truly independent
- [ ] Each task specifies exact file path or pnpm command
- [ ] Tasks cover CI, migrations, motion, and accessibility requirements
- [ ] Constitution deviations documented if present
