# Quickstart — Bulk JSON Idea Import

## Prerequisites
- Dockerized Postgres (`ideavault-db`) or Neon connection running with migrations applied.
- `.env.local` populated (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, Auth.js provider secrets, Upstash credentials).
- `pnpm install` complete and Playwright browsers installed (`pnpm playwright install`).
- Development server running via `pnpm dev` on http://localhost:3000.

## Smoke Test Checklist
1. **Authenticate**
   - Navigate to `/login`, sign in using owner credentials (magic link or password).
2. **Export Baseline**
   - On `/dashboard/ideas`, click `Export all ideas` to download the canonical JSON file.
3. **Modify JSON**
   - Open the file, duplicate one idea and tweak its title/notes, optionally edit a feature title.
4. **Import**
   - Click the new `Import ideas` button (to the right of `Export all ideas`).
   - Choose the edited JSON file. Wait for the preview modal and review the diff summary.
   - For duplicate title prompts, pick **Update existing** or **Create new**; use the "Apply to all" action to cascade the decision when appropriate.
5. **Verify Updates**
   - Ensure the dashboard reflects the new idea and updated feature titles without reloading (the success toast includes created/updated counts).
   - Use `router.refresh()` or the browser reload if you want to double-check counts after large imports.
6. **Negative Path**
   - Try importing a malformed JSON file (<100 B). Confirm the flow rejects it with validation details, shows the "Import failed" toast, and leaves existing data untouched.

## Validation Commands
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm playwright test --project=chromium tests/e2e/ideas-import.spec.ts` *(to be authored in Phase 1)*
- `pnpm lighthouse`

## Rollback Strategy
- Use the existing undo window (10 s) for accidental feature deletions.
- If import applies unwanted updates, re-import the previously exported JSON or manually revert via the dashboard.
