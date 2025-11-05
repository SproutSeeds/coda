# Tasks Index

Execution checklists scoped to feature branches.

- Feature User Limitations — Task List: `Tasks/feature-user-limitations.md`
- Companion plan: `Plans/feature-user-limitations.md`
- Companion philosophy: `Philosophies/feature-user-limitations-philosophy.md`

Frontmatter and Sync
- Each tasks doc uses `doc: tasks`, `id`, `planRef`, `planVersion`, `philosophyRef`, `lastUpdated`, and `status`.
- Keep tasks `planVersion` aligned with the plan’s `version`.
- Run `pnpm doc:sync` after editing plans or tasks to regenerate companion docs.
- Validate with `pnpm doc:check-sync` before committing.

