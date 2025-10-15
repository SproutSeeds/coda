# Phase 0 Research — Bulk JSON Idea Import

## 1. Import Payload Schema & Validation
- **Decision**: Treat the existing export payload (`{ exportedAt, ideaCount, featureCount, ideas: [{ idea, features }] }`) as the canonical schema and require a `schemaVersion` field (default `1`) during validation. Enforce ingestion through a drizzle-zod schema that checks idea/feature attributes, file size (<5 MB), and ownership alignment before mutations.
- **Rationale**: Reusing the export contract guarantees parity between export/import, simplifies documentation, and allows incremental evolution via `schemaVersion`. The size cap protects Server Actions from large payloads and keeps Lighthouse/network scores stable.
- **Alternatives Considered**:
  - *Accept arbitrary JSON and infer shape at runtime*: rejected due to high validation complexity and security risk.
  - *Introduce a brand-new import schema*: rejected because it would drift from the user-facing export file and create maintenance overhead.

## 2. Conflict Detection & Merge Strategy
- **Decision**: Detect conflicts primarily by normalized idea title (trimmed, case-insensitive) per specification, then map to the current idea `id`. When the user selects "update", mutate only fields that differ (`notes`, `metadata`, ordering, starred) and merge features by `id`; unseen features remain untouched, new feature IDs are generated server-side if missing.
- **Rationale**: Title-based prompts align with the UX requirement while still anchoring updates to actual primary keys. Field-level diffs prevent accidental overwrites and respect the clarification that only changed values should move.
- **Alternatives Considered**:
  - *Require IDs-only matching*: rejected because imports from other workspaces would fail due to differing UUIDs.
  - *Always duplicate records on conflict*: rejected since the user explicitly wants the option to update existing ideas.

## 3. Import Flow UX & Feedback
- **Decision**: Implement the import entry point as a button next to "Export all ideas" that triggers a hidden file input limited to `.json`. After upload, the server action analyzes the payload, produces a diff summary (new/updated/skipped/error counts), and returns it for a confirmation modal before applying mutations. Progress uses non-blocking toasts and loading states that integrate with the existing `interactive-btn` hover treatment and respects prefers-reduced-motion.
- **Rationale**: Keeping the interaction inline with existing controls maintains UI consistency, while a summary modal satisfies the requirement to review differences. Using toasts/loading states matches the established feedback patterns in the dashboard.
- **Alternatives Considered**:
  - *Perform import immediately without confirmation*: rejected because users need to vet large diff operations.
  - *Redirect to a separate import page*: rejected to avoid context switching and additional navigation overhead.

## 4. Error Handling & Observability
- **Decision**: Fail the entire transaction if validation errors occur, reporting aggregated issues (missing fields, malformed JSON, unauthorized IDs) in the confirmation modal. Log import attempts and outcomes via existing analytics hooks and ensure rate limits apply to prevent brute-force uploads.
- **Rationale**: Atomic failure keeps data integrity intact and simplifies undo expectations. Observability helps diagnose malformed payloads or abuse.
- **Alternatives Considered**:
  - *Partial success with per-record skips*: rejected for this iteration because it complicates user expectations and audit trails; can be revisited later.
