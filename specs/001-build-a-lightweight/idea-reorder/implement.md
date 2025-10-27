# Implementation Guide — Idea Reorder

Key actions:
- Run migration for `position` column.
- Deploy `reorderIdeasAction` and ensure ordered queries everywhere.
- Layer in DnD kit with keyboard support and debounced persistence.
- Extend tests/docs to cover the new behaviour.
