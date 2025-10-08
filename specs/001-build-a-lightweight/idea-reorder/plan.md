# Implementation Plan — Idea Reorder

# Plan Input — Idea Reordering & Companion Docs

Use this as the user argument when invoking `.codex/prompts/plan.md`.

## Desired Outcome
- Add drag-and-drop reordering for ideas so users can rearrange cards and keep the sequence after logging out.
- Persist order via a new sortable column on `ideas`, ensuring all reads respect the saved ordering.
- Deliver a short companion explanation for the new server/client files using `.codex/prompts/accompany.md`.

## Key Constraints & Considerations
- Maintain existing undo, search, and rate-limiting behavior.
- Keyboard-accessible drag handles; respect `prefers-reduced-motion`.
- Minimize server chatter (batch or debounce reorder writes).
- Update Playwright coverage to confirm order persistence.

## Follow-up Prompts
- After the plan solidifies, run `.codex/prompts/accompany.md` for any new files (e.g., reorder action, drag-drop component) so teammates get quick context summaries.


## Workstreams
1. **Schema & Data Layer**
   - Add `position` column via drizzle migration (default stride 1000).
   - Update `lib/db/schema.ts` and seed existing rows.
   - Extend query helpers to order by `position, createdAt`.
2. **Server Actions & API**
   - Create `reorderIdeasAction` accepting ordered ID array; validate ownership.
   - Expose REST endpoint if needed for testing.
   - Update analytics hooks for reorder events.
3. **Client Experience**
   - Integrate drag-and-drop (`@dnd-kit`) with keyboard support.
   - Add optimistic move animations, fall back for reduced motion.
   - Debounce reorder updates (e.g., 300ms) and manage focus.
4. **Testing & Docs**
   - Unit test reorder action validation.
   - Playwright flow: reorder, refresh, logout/login.
   - Update README quickstart + specs documentation.
