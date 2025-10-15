# Tasks: Bulk JSON Idea Import

**Input**: Design documents from `/specs/003-build-out-a/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup
- [X] T001 Prepare shared fixtures for import tests by capturing a fresh export bundle in `tests/fixtures/import/export-sample.json` and trimming it to a minimal reproducible dataset (one existing idea with features, one new idea payload).

## Phase 3.2: Tests First (TDD)
- [X] T002 [P] Author Vitest unit tests for import validation helpers in `tests/unit/import-validation.test.ts`, covering schema version defaults, size limit (≤5 MB), title normalization, and feature merge semantics.
- [X] T003 [P] Create contract tests for `importIdeasAction` (preview + commit flows) in `tests/contracts/import-ideas-action.test.ts`, asserting diff summary shape, conflict prompting, and partial-update behavior.
- [X] T004 [P] Write Playwright scenario `tests/e2e/ideas-import.spec.ts` that uploads the fixture, resolves duplicate-title prompts, confirms success toast details, and verifies malformed JSON rejection.

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [X] T005 Implement drizzle-zod schemas and helper utilities for `ImportEnvelope`, `IdeaImportBundle`, and `FeatureImportItem` in `lib/validations/import.ts`, exporting parsed types for downstream use.
- [X] T006 Build diff + normalization helpers in `lib/utils/import-diff.ts` to compare payload vs. database records and return the preview summary structure defined in the data model.
- [X] T007 Implement `importIdeasAction` (preview + commit) in `app/dashboard/ideas/actions/import.ts`, integrating validation, diff helpers, conflict decisions, and emitting analytics events (`ideas_import_attempt`, `ideas_import_complete`, `ideas_import_error`).
- [X] T008 Wire the new server action into the dashboard actions index (`app/dashboard/ideas/actions/index.ts`) and ensure only changed fields/features are persisted when updating duplicates.
- [X] T009 Extend analytics wiring (`lib/utils/analytics.ts`) to register the new import events and ensure payloads include counts and durations per research guidance.

## Phase 3.4: Integration & UI
- [X] T010 Update the ideas toolbar (`app/dashboard/ideas/components/IdeaBoard.tsx`) to add the "Import ideas" button beside "Export all ideas", managing hidden file input + keyboard accessibility.
- [X] T011 Create an import flow controller component (`app/dashboard/ideas/components/ImportIdeasDialog.tsx`) to render the diff summary modal, conflict decision UI (with "apply to all" support), and confirmation controls.
- [X] T012 Integrate toast + loading feedback in `app/dashboard/ideas/components/IdeaBoard.tsx` (or adjacent client hooks) so preview, success, and error states respect the standard `interactive-btn` polish and prefers-reduced-motion.
- [X] T013 Ensure Server Action wiring handles file uploads by updating the client-side invocation (e.g., `app/dashboard/ideas/components/hooks/useImportIdeas.ts`) and verifying CSRF/session handling via Auth.js utilities.
- [X] T014 Add Playwright test utilities / fixtures (e.g., `tests/e2e/fixtures/import.ts`) to streamline uploading JSON files during e2e scenarios.

## Phase 3.5: Polish & Validation
- [X] T015 Update developer docs: augment `specs/003-build-out-a/quickstart.md` and root `README.md` with the import workflow, conflict resolution expectations, and Upstash/Vercel considerations.
- [X] T016 Add monitoring for import outcomes by updating any analytics dashboards or logging helpers (e.g., `docs/observability.md`) to surface the new events.
- [ ] T017 Run and capture `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test --project=chromium tests/e2e/ideas-import.spec.ts`, `pnpm lighthouse`, noting evidence in `evidence/`.
- [ ] T018 Perform final accessibility + motion QA on the import dialog (focus traps, ESC behavior) and ensure Lighthouse Accessibility ≥ 90 remains intact.

## Dependencies
- T001 → T002-T004 (fixtures required for tests).
- T002-T004 → T005-T008 (tests must fail before implementation).
- T005 → T006 (schemas feed diff helpers).
- T006 → T007 (diff helpers required before building action).
- T007 → T008-T013 (server action must exist before UI integration).
- T010-T012 depend on T008 (action exports available) and T013 (client hook ensures upload pipeline).
- T014 depends on T004 (scenario spec) for alignment.
- T015-T018 run after core + integration steps are green.

## Parallel Execution Examples
```
# Once fixtures exist, kick off TDD in parallel:
/run task T002
/run task T003
/run task T004

# After server action lands, parallelize UI polish:
/run task T010
/run task T011
/run task T012
```

## Closing Notes
- Maintain TDD discipline—do not implement `importIdeasAction` until contract tests fail.
- Keep payload parsing on the server; no raw JSON processing client-side.
- Preserve existing export functionality and undo semantics while introducing the import path.
