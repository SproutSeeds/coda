# Problem Statement
We have GitHub OAuth live and a developer-only owner-token shortcut, but production must also support classic email “magic link” sign-in. We need to add Auth.js Email provider support, persist verification tokens via Drizzle, and ensure tests & docs cover both auth flows without regressing existing quality gates.

# Desired Outcomes
- Visitors can request a sign-in link by entering their email on `/login`; clicking the emailed link authenticates them and redirects to `/dashboard/ideas`.
- Auth.js leverages a Drizzle-backed adapter so email, account, session, and verification token records persist correctly in Postgres.
- Automated test suites (Vitest + Playwright) cover the new flow, including rate limits, error states, and email link consumption.
- Documentation (README, quickstart, deployment guide) explains SMTP setup, required env vars, and how to toggle the dev shortcut.

# Scope & Constraints
- Maintain GitHub OAuth as a primary provider; email login supplements it. Owner-token dev shortcut stays guarded by `ENABLE_DEV_LOGIN` and must be disabled in production docs.
- Choose a transactional email service (e.g. Resend, Postmark, SendGrid). Provide configuration instructions and env var references.
- Add Drizzle migrations for Auth.js tables (users/contracts, accounts, sessions, verification tokens) without disrupting existing idea schema or data. Include rollback guidance if needed.
- Keep undo flow, rate-limiting, analytics instrumentation intact. Email link requests should respect rate limits.
- Update specs (`specs/001-build-a-lightweight/plan.md`, `quickstart.md`, `tasks.md`) and rerun `.specify/scripts/bash/update-agent-context.sh codex` after task completion.

# Deliverables
- Updated plan entries for email auth in `specs/001-build-a-lightweight/plan.md` and corresponding tasks in `tasks.md` (Phase 3.x).
- New Drizzle migration + schema adapter for Auth.js.
- Extended auth UX on `/login` to include email entry + success/error states.
- Server actions/API routes for sending magic links, verifying tokens, and linking accounts.
- New environment variable documentation and .env example entries (`EMAIL_SERVER`, `EMAIL_FROM`, provider-specific secrets).
- Expanded Playwright scenarios: email sign-in happy path, invalid token, rate limit.
- Evidence of `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, and email-provider smoke test (if possible).

# Dependencies & Risks
- SMTP provider access & credentials; blocked deployment if none configured.
- Need to ensure migrations run before deploying (document `pnpm drizzle-kit migrate`).
- Existing GitHub flow must remain functional; owner-token dev helper should bypass email to keep tests quick.
- Running Playwright email flows may require a mock inbox strategy or local mail catcher.
