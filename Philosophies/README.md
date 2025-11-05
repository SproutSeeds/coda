# Philosophies Index

Guiding principles that pair with Plans to explain the why behind implementation.

- Feature User Limitations — Philosophy: `Philosophies/feature-user-limitations-philosophy.md`
- Companion plan: `Plans/feature-user-limitations.md`
- Companion tasks: `Tasks/feature-user-limitations.md`

Frontmatter and Sync
- Each philosophy carries YAML frontmatter with `doc: philosophy`, `id`, `planRef`, `planVersion`, `lastReviewed`, and `reviewCadence`.
- Keep `planVersion` equal to the companion plan’s `version`.
- Developers can run `pnpm doc:sync` locally to auto-generate or update the companion philosophy when a plan changes.
- Follow with `pnpm doc:check-sync` locally before pushing to catch any drift across plan, philosophy, and tasks.
