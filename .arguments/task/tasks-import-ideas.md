Generate the dependency-ordered task list for **Bulk JSON Idea Import** (`specs/003-build-out-a`). Follow TDD, obey the constitution, and ensure tasks are granular enough for Codex to execute.

### Planning Inputs
- Use plan (`specs/003-build-out-a/plan.md`), research, data-model, contract, and quickstart documents generated for this feature.
- Existing export flows (`exportIdeaAsJsonAction`, `exportAllIdeasAsJsonAction`) must remain untouched; new work layers on top via import-specific utilities.
- Merge rule: when updating duplicates, only changed fields/features are mutated; untouched data must remain intact.

### Expectations
- Number tasks starting at `T001` (scaffold already complete). Maintain strict ordering and note prerequisites.
- TDD first: create validation + contract tests before implementing import logic or UI.
- Include tasks for:
  * Validation helpers & drizzle-zod schema for `ImportEnvelope`, `IdeaImportBundle`, `FeatureImportItem`.
  * Preview/commit server action (`importIdeasAction`) that returns diff summaries and applies updates based on conflict decisions.
  * File-upload handling, size checks, and JSON parsing.
  * Analytics events (`ideas_import_attempt`, `ideas_import_complete`, `ideas_import_error`).
  * UI updates: toolbar button beside "Export all ideas", confirmation modal, conflict decision UI, toasts.
  * Playwright coverage for import preview → conflict resolution → success path, plus malformed file rejection.
  * Documentation updates (README snippet if needed) and quickstart verification.
  * Ensure `.specify/memory/scaffold.ok` check remains satisfied (no scaffold tasks required).
- Mark parallel-safe tasks with `[P]` (e.g., independent tests). Shared files stay sequential.
- Reference precise file paths (`app/dashboard/ideas/actions/import.ts`, `lib/validations/import.ts`, `tests/e2e/ideas-import.spec.ts`, etc.).
- Finish with polish tasks: Lighthouse run, analytics verification, doc updates.
