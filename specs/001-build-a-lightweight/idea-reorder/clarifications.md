# Clarifications — Idea Reorder

1. **Do we need cross-user ordering or shared boards?**
   - No. Ordering remains per owner; no shared boards this iteration.
2. **Should undo restore original index even if other reorders occurred after deletion?**
   - Yes. Restore the idea to the exact stored `position`; surrounding ideas keep their current order.
3. **What stride should initial positions use?**
   - Seed new ideas with `position = 1000 * row_number` so we can insert fractional values (e.g., midpoints) without bulk rewrites.
4. **Is browser drag-and-drop acceptable, or do we require a specific library?**
   - Use a modern library such as `@dnd-kit/core` for consistent keyboard support and collision detection; avoid HTML5 drag APIs due to accessibility gaps.
5. **How do we treat filtered views during reorder?**
   - Reordering is disabled while filters are active to avoid partial payloads; clear the search box to adjust the canonical order.
