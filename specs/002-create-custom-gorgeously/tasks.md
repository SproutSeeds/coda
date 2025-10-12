# Tasks: Custom Light & Dark Mode Preferences

**Input**: Design documents from `/specs/002-create-custom-gorgeously/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup
- [ ] T001 Verify Next.js App Router configuration and Tailwind/shadcn setup align with constitution (run `pnpm lint` to ensure no structural lint errors).
- [ ] T002 Ensure `next-themes` dependency is installed and added to `package.json`; document addition in CHANGELOG.
- [ ] T003 [P] Create Drizzle migration stub `drizzle/migrations/0012_add_theme_preferences.sql` for new table.

## Phase 3.2: Tests First (TDD)
- [ ] T004 [P] Write contract test for `updateThemePreference` Server Action in `tests/contracts/theme-preference.test.ts` (assert 401/422/success cases).
- [ ] T005 [P] Author Vitest unit tests for `theme_preferences` schema validation in `tests/unit/theme-preferences.test.ts` (drizzle-zod outputs).
- [ ] T006 [P] Implement Playwright scenario `tests/e2e/account-theme.spec.ts` covering first-load prompt, manual toggle, and persistence.
- [ ] T007 [P] Extend Lighthouse acceptance doc `tests/perf/lighthouse.md` with dark/light check instructions.

## Phase 3.3: Core Implementation
- [ ] T008 Implement Drizzle schema and migration for `theme_preferences` in `lib/db/schema.ts` and new migration file.
- [ ] T009 Generate Zod schema and validator via drizzle-zod in `lib/validations/theme-preference.ts`.
- [ ] T010 Implement `updateThemePreference` Server Action in `app/dashboard/account/actions.ts` (upsert logic, telemetry emit).
- [ ] T011 Build `ThemeToggle` client component in `components/account/theme-toggle.tsx` using `next-themes` and lucide icons.
- [ ] T012 Wire first-load 10s countdown banner in `app/dashboard/account/page.tsx`, hooking into Server Action + toast.
- [ ] T013 Detect `forced-colors: active` and adjust palette by extending CSS in `styles/globals.css` with high-contrast overrides.

## Phase 3.4: Integration
- [ ] T014 Execute Drizzle migration (`pnpm drizzle-kit generate && pnpm drizzle-kit migrate`) and verify table in target DB.
- [ ] T015 Update Auth session loader (`lib/auth/session.ts`) to include theme preference in returned session context.
- [ ] T016 Persist preference on sign-in/out hooks if needed (ensure logout clears in-memory state) in `app/api/auth/[...nextauth]/route.ts`.
- [ ] T017 Add telemetry event handler for `theme_preference.updated` in `lib/utils/analytics.ts`.
- [ ] T018 Update CI docs or scripts if new checks are required (none expected; confirm).

## Phase 3.5: Polish
- [ ] T019 [P] Refine Tailwind tokens for both themes ensuring WCAG AA; document tokens in `styles/theme.css`.
- [ ] T020 [P] Validate Framer Motion timing for theme toggle transitions (150–200 ms) in `components/account/theme-toggle.tsx`.
- [ ] T021 Update `specs/002-create-custom-gorgeously/quickstart.md` with final validation observations.
- [ ] T022 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test --grep "theme"`, and `pnpm lighthouse` recording results.

## Dependencies
- T004–T007 must be completed (tests failing) before starting T008–T013.
- T008 blocks T009 and T014.
- T010 depends on T008/T009 and contract tests (T004).
- T011–T013 depend on Server Action (T010) and validators (T009).
- T014 must precede any production verification.

## Parallel Execution Examples
```
Planner.parallel([
  "T004 Write contract test in tests/contracts/theme-preference.test.ts",
  "T005 Vitest schema tests in tests/unit/theme-preferences.test.ts",
  "T006 Playwright scenario in tests/e2e/account-theme.spec.ts"
])
```

```
Planner.parallel([
  "T019 Refine Tailwind tokens in styles/theme.css",
  "T020 Validate motion timing in components/account/theme-toggle.tsx"
])
```

## Notes
- [P] denotes tasks safe to run in parallel (different files, no dependencies).
- Keep commits scoped (setup, tests, core, integration, polish).
- Update spec/plan if unforeseen scope changes arise.
- Flag any constitution deviations immediately in Complexity Tracking.

