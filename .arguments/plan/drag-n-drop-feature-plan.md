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
