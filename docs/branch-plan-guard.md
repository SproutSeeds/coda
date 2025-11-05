# Branch & Plan Guard

This repo enforces a “branch-first, plan-first” workflow so every feature branch ships with a documented implementation plan, companion philosophy, and execution task list.

## How it works
- `pnpm guard` runs `scripts/ensure-branch-plan.mjs`.
- The guard verifies you are on a non-protected branch (anything other than `main`, `master`, `develop`, `release`, `staging`).
- It derives a slug from the current branch (e.g. `feature/user-limitations` → `feature-user-limitations`).
- If `Plans/<slug>.md` exists, the guard normalizes its frontmatter and title, syncs the companion philosophy and tasks checklist, and runs `pnpm doc:sync` + `pnpm doc:check-sync`.
- If the plan is missing, the guard prompts you to:
  1. Rename an existing plan to the branch slug (also renames/syncs its philosophy), or
  2. Scaffold a new plan stub with default sections.
- Companion philosophy files live at `Philosophies/<slug>-philosophy.md` and task lists at `Tasks/<slug>.md`; the guard keeps the trio aligned.

## Automatic invocation
- `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm e2e` all run the guard first (via `pre*` scripts in `package.json`).
- Run `pnpm guard` manually any time to check status.

## Workflow tips
- If you need to associate an existing plan with a new branch, choose option 1 when prompted and enter the existing filename (without `.md`).
- To start fresh, press Enter at the prompt—this creates stub plan, philosophy, and tasks docs ready for editing.
- After the guard succeeds, proceed with your normal development flow; the necessary docs are in place and kept in sync.
