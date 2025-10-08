# Implement — Idea Reorder

## Pre-flight
- Ensure migration has not yet been applied; prepare to run `pnpm db:migrate` with updated drizzle config.
- Install `@dnd-kit/core` and `@dnd-kit/sortable` before touching the UI.
- Set `SPECIFY_FEATURE=001-build-a-lightweight` for helper scripts.

## Execution Steps
1. **Data Layer**
   - Create migration adding `position numeric` column with default stride 1000.
   - Update schema types and seed existing ideas.
2. **Server**
   - Implement `reorderIdeasAction` + REST route (if needed), including validation, analytics, and transaction.
   - Update loaders to order by `position`.
3. **Client**
   - Integrate drag-and-drop in `IdeaList` with keyboard controls, optimistic updates, reduced-motion support, and debounced persistence.
   - Update undo/delete flows to coexist with new ordering.
4. **Tests & Docs**
   - Extend unit + Playwright coverage for reorder scenarios.
   - Refresh README/specs/AGENTS with ordering guidance.

## Verification
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, and migration rollback forward check.
- Local manual QA: drag via mouse & keyboard, filter+drag, undo after reorder, reload, logout/login.
