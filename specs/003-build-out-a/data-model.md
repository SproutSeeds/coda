# Phase 1 Data Model — Bulk JSON Idea Import

## IdeaImportBundle
- **Represents**: A single idea entry from the uploaded JSON, including metadata and nested features.
- **Fields**:
  - `idea.id?: string` — optional UUID supplied by export; ignored when creating new ideas.
  - `idea.title: string` — required, trimmed; used for conflict detection (case-insensitive).
  - `idea.notes?: string` — optional long-form notes.
  - `idea.position?: number` — optional ordering hint (defaults to append when missing).
  - `idea.githubUrl?: string | null` — optional reference link.
  - `idea.linkLabel?: string | null` — optional label for the reference link.
  - `idea.starred?: boolean` — optional prioritization flag.
  - `idea.createdAt/updatedAt?: string` — optional timestamps; import rewrites with server time when creating new records.
  - `features: FeatureImportItem[]` — nested collection describing feature cards.
- **Validation Rules**:
  - Title must be non-empty after trim and ≤ 140 chars (align existing constraints).
  - Notes limited to current Idea textarea limit (10 k chars) to avoid overflow.
  - Positions should be positive integers; fallback handled when absent.

## FeatureImportItem
- **Represents**: A single feature entry associated with an idea in the import payload.
- **Fields**:
  - `id?: string` — optional UUID from export; used to update existing features when present.
  - `ideaId?: string` — optional; ignored for imports because ownership is derived from parent idea.
  - `title: string` — required, trimmed; ≤ 140 chars.
  - `notes?: string` — optional descriptive text.
  - `detail?: string` — optional rich detail body.
  - `detailLabel?: string` — optional label (defaults to "Detail" if missing).
  - `position?: number` — optional ordering hint relative to sibling features.
  - `starred?: boolean` — optional prioritization flag.
  - `completed?: boolean` — optional completion flag; `completedAt` can accompany when true.
  - `deletedAt?: string | null` — ignored on import; never hydrate deleted records.
- **Validation Rules**:
  - Title must be non-empty after trim.
  - Detail/notes limited to existing length constraints (10 k chars combined).
  - When `completed` is true, `completedAt` must be ISO timestamp or set by server.

## ImportEnvelope
- **Represents**: The root JSON payload supplied by the user.
- **Fields**:
  - `schemaVersion: number` — optional, defaults to `1`.
  - `exportedAt: string` — ISO timestamp from export; informational.
  - `ideaCount: number` — expected count; revalidated during import.
  - `featureCount: number` — expected count; revalidated during import.
  - `ideas: IdeaImportBundle[]` — primary content; must not exceed pagination cap (<= 1000 entries per import cycle).
- **Validation Rules**:
  - `ideas.length` must match `ideaCount` and not exceed server-enforced limit.
  - Sum of features must match `featureCount`; mismatches flagged before confirmation.
  - File size ≤ 5 MB to avoid exhausting Server Action memory budget.

## ImportDiffSummary
- **Represents**: Preview and final reporting structure returned to the client.
- **Fields**:
  - `newIdeas: number`
  - `updatedIdeas: number`
  - `unchangedIdeas: number`
  - `newFeatures: number`
  - `updatedFeatures: number`
  - `skippedFeatures: number` — features omitted due to validation issues.
  - `conflicts: ConflictPreview[]` — duplicate-title prompts requiring user input.
  - `messages: string[]` — warnings or validation hints.
- **State Transitions**:
  - Starts as analysis output (no mutations yet), then transitions to final summary once user confirms and mutations succeed.

## ConflictDecision
- **Represents**: User choice for resolving duplicate idea titles.
- **Fields**:
  - `ideaTitle: string`
  - `action: "update" | "create-new"`
  - `applyToAll?: boolean` — whether this decision cascades to remaining duplicates.
- **State Transitions**:
  - Captured client-side after diff preview → forwarded to server action for execution.

## Observability Events
- **Import Attempt Event**:
  - `name`: `ideas_import_attempt`
  - `properties`: `{ ideaCount, featureCount, conflicts, schemaVersion }`
- **Import Complete Event**:
  - `name`: `ideas_import_complete`
  - `properties`: `{ created, updated, skipped, duration }`
- **Error Event**:
  - `name`: `ideas_import_error`
  - `properties`: `{ reason, validationErrors }`

These events allow analytics dashboards to trace adoption and troubleshoot failures without exposing raw content.
