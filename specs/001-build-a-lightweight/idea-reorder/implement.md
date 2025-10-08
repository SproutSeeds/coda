# Implementation Guide — Idea Reorder

Refer to `.arguments/implement/implement-idea-reorder.md` when running `/implement`. Key actions:
- Run migration for `position` column.
- Deploy `reorderIdeasAction` and ensure ordered queries everywhere.
- Layer in DnD kit with keyboard support and debounced persistence.
- Extend tests/docs to cover the new behaviour.
