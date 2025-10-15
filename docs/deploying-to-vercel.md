# Deploying Coda to Vercel

This guide walks through promoting the Coda MVP to Vercel using managed Postgres and Upstash Redis.

## 1. Prerequisites
- GitHub repository with the latest code pushed to the branch you plan to deploy (usually `main`).
- Vercel account with access to create projects.
- Upstash Redis database (already provisioned as `coda`).

## 2. Provision Production Datastores
### Upstash Redis
1. Open https://console.upstash.com and select your `coda` Redis database.
2. Copy the **REST URL** and **REST TOKEN**. Treat them like secrets.

### Postgres
Choose one of:
- **Vercel Postgres** (recommended): from Vercel dashboard → Storage → Postgres → Create Database. Note the connection string.
- **Bring your own Postgres**: e.g., Neon, Supabase, RDS. Make sure SSL settings fit Vercel’s environment.

## 3. Create the Vercel Project
1. From https://vercel.com/new import the GitHub repo.
2. Set the Framework Preset to **Next.js**. Vercel will infer `pnpm` automatically; keep the defaults:
   - Build Command: `pnpm build`
   - Install Command: `pnpm install --frozen-lockfile`
   - Output Directory: `.next`

## 4. Configure Environment Variables
For both **Production** and **Preview** environments, add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` (or `DATABASE_POSTGRES_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL`) | Connection string copied from your Postgres provider. |
| `NEXTAUTH_SECRET` | Random 32+ char string (generate via `openssl rand -base64 32`). |
| `NEXTAUTH_URL` | `https://<your-project>.vercel.app` (update once the domain is known). |
| `UPSTASH_REDIS_REST_URL` | REST URL from Upstash (`https://...upstash.io`). |
| `UPSTASH_REDIS_REST_TOKEN` | REST token from Upstash. |
| `EMAIL_SERVER` | SMTP connection string or host for magic-link delivery. |
| `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` | SMTP authentication details (omit user/pass for provider tokens). |
| `EMAIL_FROM` | From address shown in the magic-link email (e.g., `Coda <login@your-domain>`). |

You can use the Vercel dashboard (Settings → Environment Variables) or the CLI (`vercel env add` per variable).

## 5. Run Migrations Against Production Database
From your local machine (with `DATABASE_URL` or one of the supported aliases pointed at the production Postgres):

```bash
DATABASE_URL="<production connection string>" pnpm drizzle-kit migrate
```

> New in the drag-and-drop release: `0003_add_position_to_ideas.sql` adds the `position` column used for persistent ordering.

Run the same command for the Preview database if you provision one.

## 6. Trigger the First Deploy
Push to the tracked branch (e.g., `main`) or click **Deploy**. Watch the build logs; it should run `pnpm install`, `pnpm build`, and upload artifacts.

## 7. Smoke Test the Deployment
1. Visit `https://<your-project>.vercel.app/login`.
2. Sign in with the administrator account (the email defined by `DEVELOPER_EMAIL`) via magic link or password and confirm `/dashboard/ideas` loads.
3. Exercise create/edit/delete/undo/search flows.
4. Optionally run Playwright against the deployed URL:
   ```bash
   PLAYWRIGHT_BASE_URL="https://<your-project>.vercel.app" pnpm playwright test
   ```

## 8. Configure Cron Job
In Vercel → Project Settings → Cron Jobs, add a daily job hitting `/api/cron/purge-soft-deletes` to clear expired soft deletes.

## 9. Continuous Verification
- Set up a GitHub Actions workflow to run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, and `pnpm lighthouse` on pull requests.
- Keep Preview environments clean by mirroring env vars and running migrations before manual QA.

## 10. Optional Hardening
- Attach a custom domain in Vercel, update `NEXTAUTH_URL`, and re-run `pnpm build` deploy.
- Wire analytics (Vercel Analytics, Sentry, etc.) by adding the proper environment keys and enabling instrumentation.

With the configuration above, each push to your main branch will automatically deploy to Vercel using Upstash Redis for rate limiting and Postgres for persistence.
