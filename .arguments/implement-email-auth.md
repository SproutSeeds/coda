Execution Brief:
- Operate against `specs/001-build-a-lightweight/tasks.md` once it includes the dedicated email-auth phase. Treat the tasks file as the authoritative backlog—mark items `[ ] → [X]` as you complete them.
- Before coding, confirm `.specify/memory/scaffold.ok` exists and export `SPECIFY_FEATURE=001-build-a-lightweight` so helper scripts resolve correctly.
- Required environment variables (local + Vercel): `EMAIL_SERVER`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` (or provider-specific tokens), `EMAIL_FROM`, plus existing `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. For development, use a mail catcher (MailHog, Resend sandbox) to validate magic-link delivery.
- Implement Auth.js Email provider with Drizzle adapter tables; generate migrations via `pnpm db:generate` and apply with `pnpm db:migrate`. Ensure migrations run in preview/prod before deployment.
- Update `/login` UI, server actions, tests (Vitest + Playwright) to cover: requesting magic link, consuming token, invalid/expired token handling, rate limits. Maintain the `ENABLE_DEV_LOGIN` path for automated tests.
- Document new setup steps in README, quickstart, and deployment guide. After major changes, run `.specify/scripts/bash/update-agent-context.sh codex` to refresh `AGENTS.md`.
- Quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, `pnpm lighthouse` (if feasible) must pass before marking tasks complete.
- Capture evidence for Playwright and Lighthouse runs in `evidence/` if tasks require it.
