SPECIFY PROCESS:
- run the constitution command with the user input argument
    ```
         run the prompt detailed here: .codex/prompts/constitution.md "copy/paste full user argument from .arguments"
    ```
- run the specify command
    ```
        run the prompt detailed here: .codex/prompts/specify.md "copy/paste full user argument from .arguments"
    ```
- run the clarify command
    ```
        .codex/prompts/clarify.md
    ```
- run the plan command
    ```
        run the prompt detailed here:  .codex/prompts/plan.md "copy/paste full user argument from .arguments"
    ```
    - create the perfect user arguments prompt for task creation
        ```
            Based on that plan, create the perfect prompt to go alongside as user input to the .codex/prompts/tasks.md
        ```
- run the tasks command
    ```
        run the prompt detailed here: .codex/prompts/tasks.md "copy/paste full user argument from .arguments"
    ```
- run the implement command
    ```
        run the prompt detailed here: .codex/prompts/implement.md "copy/paste full user argument from .arguments"
    ```

## Developer Setup
1. **Clone the repo**: `git clone https://github.com/SproutSeeds/coda.git` and checkout the desired branch.
2. **Install pnpm** (v9+) and Node.js 20 if not already available.
3. **Provision local PostgreSQL**:
   - If you already run Postgres locally, create a database (for example `coda`) and update the connection string accordingly.
   - Or start a Docker container: `docker run --name coda-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`.
4. **Create environment files**:
   - Copy `.env.example` → `.env.local`.
   - Set whichever database variable fits your setup (`DATABASE_URL`, `DATABASE_POSTGRES_URL`, `POSTGRES_URL`, etc.). The app will pick the first one found, so you can reuse the name Vercel/Neon generated for you without duplicating it.
   - Generate a secret for `NEXTAUTH_SECRET`, e.g. `openssl rand -base64 32`.
   - Keep `NEXTAUTH_URL` as `http://localhost:3000` for local dev; switch to the deployed domain later.
   - Sign in to https://upstash.com, create a free Redis database, then copy its **REST URL** and **REST token** into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - Configure email delivery credentials (`EMAIL_SERVER`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`). For local iteration you can set `EMAIL_SERVER="stream"` to log outgoing emails instead of sending them.
   - (Optional) Leave `ENABLE_DEV_LOGIN="true"` to expose the owner-token fallback in development and automated tests; omit or set to `false` in production.
5. **Configure Codex CLI**:
   - Copy `.codex/config.example.toml` → `.codex/config.toml` and fill in MCP server credentials (BrightData, Context7, Firecrawl, etc.).
   - Run Codex CLI once to generate `.codex/auth.json` (sign-in).
6. **Install dependencies**: `pnpm install`.
7. **Generate database migrations**: `pnpm drizzle-kit generate`, then `pnpm drizzle-kit migrate`.
8. **Run the app locally**:
   - `pnpm dev` to start the Next.js server.
   - Visit `http://localhost:3000/login` to request a magic link or try the password form. Magic links keep you signed in until you click **Sign out**.
   - (If `ENABLE_DEV_LOGIN=true`) you can still supply `owner-token` via the developer shortcut for Playwright/local smoke tests.
9. **Verify toolchain**:
   - Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm playwright test` before pushing changes.
10. **Vercel configuration**: ensure project connected with auto previews, postbuild migration guard, and Vercel Cron for idea purge.
11. **Git hygiene**: `.gitignore` already excludes `.codex/config.toml` and `.env*`; do not commit secrets.

## App Overview
- **Dashboard**: `/dashboard/ideas` now presents minimal preview cards with search and quick delete; click a card to open the full detail view with editing controls and undo support.
- **Authentication**: Auth.js email magic links + optional password sign-in, with owner-token credentials login available locally when `ENABLE_DEV_LOGIN=true`.
- **Reordering**: Drag-and-drop (mouse, touch, or keyboard) lets you prioritize ideas; order persists across sessions automatically while recently deleted ideas stay recoverable for seven days (the tab hides when empty).
- **Features**: Click into any idea to add feature cards—each with its own notes, edit/delete controls, and activity tracking—so large concepts stay organized.
- **Server Actions**: CRUD flows live in `app/dashboard/ideas/actions/index.ts`, backed by Drizzle ORM and rate limiting.
- **UI**: shadcn components with Framer Motion transitions, Sonner toasts, and debounced search.
- **Cron + Cleanup**: daily purge of soft-deleted ideas via `scripts/purge-soft-deleted-ideas.ts` (exposed at `/api/cron/purge-soft-deletes`).

### Email-first authentication flow
1. Request a magic link from `/login` (or sign in with an existing password).
2. Auth.js creates or locates the user, sends the email, and rate limits repeated requests.
3. Verifying the link signs you in for up to a year; from there you can set a reusable password under **Account** if desired.







When Adding new features:
- Specify command with feature specifics
- plan command with

## Deploying Changes Quickly
When you’re ready to ship the current change set:

```bash
git add --pathspec-from-file=.codex/files-to-add.txt
git add .codex/files-to-add.txt
git commit -m "Refine Coda theme and idea save experience"
git push origin main
```

Adjust the commit message as needed, but keep using the pathspec file to stage only the curated files.








FEATURE PLANS/FIXES:
 
