# Quickstart – Coda MVP

## Prerequisites
- Node.js 20.x, pnpm 9+
- Vercel Postgres database (Preview + Production) or Neon for local development
- Environment variables defined:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL` (e.g., http://localhost:3000 in dev)
- `EMAIL_SERVER`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
- `PASSWORD_EMAIL_SERVER`, `PASSWORD_EMAIL_PORT`, `PASSWORD_EMAIL_USER`, `PASSWORD_EMAIL_PASSWORD`, `PASSWORD_EMAIL_FROM`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Vercel Analytics enabled on the project

## Setup
1. `cp .env.example .env.local` and populate required variables (placeholders already noted in both files).
2. `pnpm install`
3. `pnpm db:generate` to create SQL migrations for `ideas`, Auth.js tables, and optional `idea_search_audit`.
4. `pnpm db:migrate` to apply migrations locally.
5. (Optional) Seed data for demos using a forthcoming `scripts/seed-ideas.ts` helper.

## Running Locally
- `pnpm dev` launches Next.js App Router on http://localhost:3000.
- Visit http://localhost:3000/login and either request a magic link (requires `EMAIL_*` env vars) or create/sign in with a password from the credentials tab.
- Create ideas via the Ideas dashboard; ensure Auth.js email + password flows and rate limiting envs are configured before deploying.
- Use the handle (or Space + Arrow keys) to reorder ideas; recently deleted items are available in their own tab for 7 days before purge.
- Use Vercel CLI or `pnpm exec vercel-env pull` to sync shared environment variables when needed.

## Testing & Quality Gates
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (Vitest)
- `pnpm e2e` (Playwright scenarios for create/search/delete/undo)
- `pnpm lighthouse` (smoke budget for ideas list route)
- `pnpm analyze:bundle` (optional bundle size check)
- `pnpm db:generate` / `pnpm db:migrate` as needed when schema changes

## Manual QA Checklist
- Verify keyboard-only navigation across composer, list, undo snackbar.
- Confirm prefers-reduced-motion disables animations (fade-only).
- Validate undo works within 10 s and failure message appears after expiry.
- Test search for substrings and zero-state results.
- Confirm Lighthouse ≥90 across categories under 150 ms RTT, 1.6 Mbps.

## Deployment Notes
- Preview deployments auto-trigger on every push; ensure migrations gated by `VERCEL_ENV === "production"` postbuild script.
- Run `pnpm ts-node scripts/purge-soft-deleted-ideas.ts` locally before production, then schedule the script with Vercel Cron to purge rows older than 30 days.
- For production release: enable feature flag `coda.enabled`, monitor analytics, then ramp to 100%.

## Observability
- Emit events: `idea_created`, `idea_edited`, `idea_deleted`, `idea_restored`, `idea_searched`, `idea_reordered`.
- Forward errors to Sentry/PostHog when enabled; fall back to Vercel Analytics dashboards.

## Support & Escalation
- On incidents, capture request IDs + user IDs from structured logs.
- Roll back by disabling feature flag and rolling back migrations if necessary.
