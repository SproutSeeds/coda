# Idea Reorder Task Breakdown

## Phase 1 – Schema & Data Prep
- [ ] T001 Add `position` column to `ideas` via drizzle migration (default stride 1000) and backfill existing rows.
- [ ] T002 Update `lib/db/schema.ts` types and adjust query helpers to order by `position`, then `createdAt`.
- [ ] T003 Ensure search/list loaders (`loadIdeas`, `searchIdeas`) use the new ordering everywhere.

## Phase 2 – Server Actions & Validation
- [ ] T010 Implement `reorderIdeasAction` server action that accepts ordered IDs, validates ownership, and batches updates in a transaction.
- [ ] T011 Add API wrapper (if needed) plus analytics event `idea_reordered` with delta information.
- [ ] T012 Write unit tests for reorder validation and transactional update logic.

## Phase 3 – Client Drag & Drop UX
- [ ] T020 Install and configure `@dnd-kit` (or preferred library) with keyboard-accessible drag handles.
- [ ] T021 Build `IdeaList` drag/drop layer: optimistic reordering, animated transitions, respects `prefers-reduced-motion`.
- [ ] T022 Debounce server updates (~300ms) and surface error toast + rollback if reorder persists fails.
- [ ] T023 Ensure undo/delete flows still behave correctly after reordering (manual QA + state reset).

## Phase 4 – Testing & Docs
- [ ] T030 Add Playwright scenario: reorder, refresh, logout/login to confirm persistence.
- [ ] T031 Update README + spec docs summarising new ordering capability and environment impact.
- [ ] T032 Capture changelog/AGENTS updates reflecting drag-and-drop ordering.
