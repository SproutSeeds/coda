Generate the execution-ready task list for **IdeaVault MVP** (feature directory `specs/001-build-a-lightweight`). Follow TDD, honor constitution guardrails, and keep tasks specific enough for an LLM agent to run sequentially or in parallel.

### Context
- Enforce **G0 scaffold gate** first: if `.specify/memory/scaffold.ok` is missing, top-priority task is `T000 – Scaffold Next.js app` using pnpm Next.js App Router template, Tailwind, shadcn/ui, Drizzle, Auth.js, Upstash rate limiting (see plan).
- Tech stack (strict): Next.js 14 App Router + TypeScript 5.x, Tailwind + shadcn/ui, Framer Motion, Auth.js (credentials + GitHub OAuth), Drizzle ORM/Kit + drizzle-zod, PostgreSQL (Vercel Postgres/Neon), Upstash Redis rate limiting, Vercel Analytics, Vitest, Playwright, Lighthouse CI.
- CRUD flows via **Server Actions**: `addIdea`, `editIdea`, `listIdeas`, `searchIdeas`, `deleteIdea`, `undoDelete`.
- **Data model**: `ideas` table (soft delete fields `deleted_at`, `undo_token`, `undo_expires_at`); optional feature-flagged `idea_search_audit`.
- **Search**: Postgres trigram GIN index on title + notes.
- **Undo**: 10 s undo window, cron-based purge after 30 days.
- **Quality gates**: pnpm `lint`, `typecheck`, `build`, Vitest, Playwright scenarios (login, CRUD, undo, search, empty state), Lighthouse ≥ 90 in all categories, prefers-reduced-motion support.
- **Observability**: events `idea_created`, `idea_edited`, `idea_deleted`, `idea_restored`, `idea_searched`, latency logging, Vercel Analytics.

### Task expectations
- Number tasks `T000`, `T001`, … with dependency notes.
- Mark truly parallel-capable tasks with `[P]`; keep shared-file work sequential.
- Tests precede implementation (generate synthetic failing tests where needed).
- Cover setup (scaffold, env, scripts), Drizzle schema + migrations, Server Actions, UI components (composer, list, search, undo snackbar), validation helpers, rate limiting, analytics hooks, CI pipelines, docs/QA updates from quickstart.
- Include cleanup tasks (e.g., add `.specify/memory/scaffold.ok` sentinel after scaffold).
- Reference concrete file paths (e.g., `app/(dashboard)/ideas/page.tsx`, `lib/db/schema.ts`, `tests/e2e/ideas.spec.ts`).

Produce `specs/001-build-a-lightweight/tasks.md` ready for /implement.
