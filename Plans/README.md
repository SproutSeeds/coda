# Plans Index

Short guides and implementation plans for platform features.

- Feature User Limitations — Implementation Plan: `Plans/feature-user-limitations.md`
- Companion philosophy: `Philosophies/feature-user-limitations-philosophy.md`
- Companion tasks: `Tasks/feature-user-limitations.md`

Frontmatter and Sync
- Each plan carries YAML frontmatter with `doc: plan`, `id`, `version`, `lastUpdated`, and `philosophyRef`.
- Companion philosophies mirror the plan’s `version` via `planVersion`.
- Local flow: run `pnpm doc:sync` when you add or edit a plan to auto-create/update the philosophy stub.
- Afterward, run `pnpm doc:check-sync` locally before pushing to ensure plan ⇄ philosophy ⇄ tasks remain aligned.
