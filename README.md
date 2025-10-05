SPECIFY PROCESS:
- run the constitution command with the user input argument
    ```
        .codex/prompts/constitution.md replace $ARGUMENTS with .arguments/constitution-arg-1.md
    ```
- run the specify command
    ```
        .codex/prompts/specify.md replace $ARGUMENTS with .arguments/specify-arg-1.md
    ```
- run the clarify command
    ```
        .codex/prompts/clarify.md
    ```
- run the plan command
    ```
        .codex/prompts/plan.md replace $ARGUMENTS with .arguments/plan-tech-stack.md
    ```
- run the tasks command
    ```
        .codex/prompts/tasks.md
    ```
- run the implement command
    ```
        .codex/prompts/implement.md
    ```

## Developer Setup
1. **Clone the repo**: `git clone https://github.com/SproutSeeds/coda.git` and checkout the desired branch.
2. **Install pnpm** (v9+) and Node.js 20 if not already available.
3. **Create environment files**:
   - Copy `.env.example` → `.env.local` and populate credentials (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
4. **Configure Codex CLI**:
   - Copy `.codex/config.example.toml` → `.codex/config.toml` and fill in MCP server credentials (BrightData, Context7, Firecrawl, etc.).
   - Run Codex CLI once to generate `.codex/auth.json` (sign-in).
5. **Install dependencies**: `pnpm install`.
6. **Generate database migrations**: `pnpm drizzle-kit generate`, then `pnpm drizzle-kit migrate`.
7. **Run setup scripts / verify**:
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm lighthouse`.
   - `pnpm dev` to start the Next.js app locally.
8. **Vercel configuration**: ensure project connected with auto previews, postbuild migration guard, and Vercel Cron for idea purge.
9. **Git hygiene**: `.gitignore` already excludes `.codex/config.toml` and `.env*`; do not commit secrets.
