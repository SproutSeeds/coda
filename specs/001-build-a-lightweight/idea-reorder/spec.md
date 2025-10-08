# Idea Reorder Specification

Add persistent drag-and-drop reordering so Coda users control the sequence of their ideas.

## Problem & Why
Currently ideas are locked to created-at order. Product owners want to groom backlogs, bubble priorities, and group related thoughts. Manual ordering keeps the list actionable and reduces rework in external tools.

## Primary Outcomes
- Each idea row exposes an accessible drag handle (and keyboard shortcuts) so users can reorder cards without leaving the dashboard.
- The new order persists via a dedicated `position` column and is respected on reload, across sessions, and after search filters clear.
- Reordering feels snappy: cards animate smoothly, avoids clipping, honors `prefers-reduced-motion`, and batches server writes to avoid thrash.

## User Stories
- **As a planner**, I want to drag the most urgent idea to the top so I know what to tackle next.
- **As a curator**, I want my theme clusters to stay grouped after I close the app, so the structure is ready next time.
- **As a keyboard user**, I need arrow-based reordering so I can manage the list without a mouse.

## Functional Requirements
1. **Sort Column**: Add `position` (numeric) to `ideas`; default to creation order and include in migrations/schema.
2. **Ordering Queries**: All list/search loaders order by `position`, then `createdAt` as a tiebreaker.
3. **Reorder Action**: Authenticated users can submit an ordered array of idea IDs; server validates ownership and updates positions atomically.
4. **Client Drag & Drop**: Implement drag UI (likely `@dnd-kit`) with keyboard support, optimistic previews, and debounced persistence (e.g., 300ms).
5. **Undo Visibility**: Undo toast still works after reorder—if an item is deleted/undone, surrounding order remains stable.

## Non-Goals
- Multi-select or bulk reordering beyond single-card moves.
- Cross-user collaborative ordering; keep order scoped per owner.
- Automatic grouping, kanban, or nested hierarchies.

## UX Principles
- **Delight with restraint**: motion hints priority changes but never blocks input.
- **Respect accessibility**: drag handle is focusable, ARIA-live announces order changes, `prefers-reduced-motion` fades instead of slides.
- **Trustworthy persistence**: no flicker or surprise resorting after saving.

## Success Criteria
- Dragging an idea updates its position server-side within 1s of drop.
- Reloading the page preserves the latest user-defined order.
- Keyboard reorder (Space + Arrow) updates order with the same latency.
- Playwright regression proves order persists across logout/login.

## Acceptance Criteria (Gherkin)
- **Reorder**: Given I have several ideas, when I drag an idea to a new slot and release, then the list reflows and the idea stays in that slot after refresh.
- **Keyboard**: Given I focus the drag handle, when I press `Space` then `ArrowUp`, then the idea moves up one position.
- **Isolation**: Given two users reorder their lists differently, when each refreshes, then they see their own saved order without leaking.
- **Undo Stability**: Given I delete and undo an idea after reordering, when it returns, then surrounding cards maintain the same relative order as before the deletion.

## Data Notes
- `position` is a `numeric`/`bigint` that enables fractional inserts (consider initial stride of 1000 to avoid rewrites).
- Reorder payload: `{ order: string[] }` representing idea IDs from top to bottom.

## Overview
We are extending Coda so signed-in users can drag ideas into whatever sequence best reflects their priorities. The current reverse-chronological list makes backlog grooming clumsy; adding persistence-aware ordering ensures the app stays useful as the collection grows.

## Key Behaviours
- Each list item exposes a drag affordance and keyboard controls to move one position at a time.
- Reordered lists persist by storing a numeric `position` column on each idea and reloading ideas using that column.
- Undoing a delete restores the idea to its prior relative position and leaves neighbouring order untouched.

## User Value
- Product planners surface the next action without exporting to a separate planning tool.
- Curators can cluster related ideas, strengthening recall and thematic planning.
- Keyboard-only users manage order with Space + Arrow interactions, preserving accessibility.

## Constraints & Non-goals
- Single-item moves only; no multi-select drag, auto-grouping, or kanban columns.
- Order remains per user; no shared ordering or collaborative editing in this iteration.
- Reordering is available in the base list; filters/search disable drag handles to avoid ambiguous partial payloads.
- We target smooth but respectful motion: obey `prefers-reduced-motion`, avoid jitter and focus loss.

## Metrics of Success
- Reorder roundtrips finish within 1 second from drop/keyboard command.
- Refreshing after a reorder always reflects the saved order.
- Playwright regression proves persistence across logout/login and undo flows.

## Dependencies & Touchpoints
- Schema migration to add `position` (numeric) with default stride (e.g., 1000) for fractional inserts.
- Server loaders and search results must sort by `position` then `createdAt` fallback.
- New reorder action validates ownership and performs batched updates per user.
- Frontend uses a modern drag-and-drop library with keyboard support and debounced persistence.

## Risks & Mitigations
- **Race conditions**: Debounce writes and include user scoping in updates to avoid interleaved requests.
- **Large lists**: Use fractional indexes to minimise full-table rewrites.
- **Motion inside undo**: Keep animation durations short and provide alternate fade for reduced-motion users.

