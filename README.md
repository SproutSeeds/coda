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
   - Set `DATABASE_URL` to match your Postgres instance (the Docker command above uses `postgres://postgres:postgres@localhost:5432/postgres`; swap the database name if you created `coda`).
   - Generate a secret for `NEXTAUTH_SECRET`, e.g. `openssl rand -base64 32`.
   - Keep `NEXTAUTH_URL` as `http://localhost:3000` for local dev; switch to the deployed domain later.
   - Sign in to https://upstash.com, create a free Redis database, then copy its **REST URL** and **REST token** into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - (Optional) Configure GitHub OAuth by creating an app at https://github.com/settings/developers and filling `GITHUB_ID` / `GITHUB_SECRET`. Leave them blank if you only need the owner-token flow during local testing.
5. **Configure Codex CLI**:
   - Copy `.codex/config.example.toml` → `.codex/config.toml` and fill in MCP server credentials (BrightData, Context7, Firecrawl, etc.).
   - Run Codex CLI once to generate `.codex/auth.json` (sign-in).
6. **Install dependencies**: `pnpm install`.
7. **Generate database migrations**: `pnpm drizzle-kit generate`, then `pnpm drizzle-kit migrate`.
8. **Run the app locally**:
   - `pnpm dev` to start the Next.js server.
   - Visit `http://localhost:3000/login` and sign in with `owner-token` (or another provisioned id) to reach `/dashboard/ideas` and exercise CRUD flows.
9. **Verify toolchain**:
   - Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm playwright test` before pushing changes.
10. **Vercel configuration**: ensure project connected with auto previews, postbuild migration guard, and Vercel Cron for idea purge.
11. **Git hygiene**: `.gitignore` already excludes `.codex/config.toml` and `.env*`; do not commit secrets.

## App Overview
- **Dashboard**: `/dashboard/ideas` lists ideas with search, optimistic editing, delete + 10s undo.
- **Authentication**: simple cookie-based session seeded via `/login` (placeholder for Auth.js).
- **Server Actions**: CRUD flows live in `app/dashboard/ideas/actions/index.ts`, backed by Drizzle ORM and rate limiting.
- **UI**: shadcn components with Framer Motion transitions, Sonner toasts, and debounced search.
- **Cron + Cleanup**: daily purge of soft-deleted ideas via `scripts/purge-soft-deleted-ideas.ts` (exposed at `/api/cron/purge-soft-deletes`).
