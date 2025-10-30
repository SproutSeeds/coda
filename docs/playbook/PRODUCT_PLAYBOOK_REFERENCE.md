# CODA Platform – Product & Technical Playbook (2025.10)

## 1. Updated Product Definition
Coda is a hybrid product-planning and delivery workspace with a built-in remote runner. The web application lets product teams capture ideas, decompose them into executable feature plans, and orchestrate automations that act on those plans. Under the hood, Coda couples a strict Next.js/TypeScript stack with Drizzle/Postgres, Upstash Redis rate limiting, and a tmux-backed terminal bridge so human workflows, CI-style automations, and AI agents all operate against the same source of truth.

The experience now extends beyond the original CLI concept:
- **Idea hub**: Reorderable kanban for ideation with autosave, soft delete + undo, JSON export/import, and idea⇄feature conversion.
- **Dev Mode**: Live runner orchestration that pairs web sessions with local tmux terminals, streams logs into Postgres, and packages a notarized Electron helper for macOS.
- **Automation-ready data layer**: Drizzle schema + `drizzle-zod` validations keep agent workflows (JSON export/import, log ingestion, job queueing) reliable without bespoke APIs.
- **Operational guardrails**: Auth.js with magic links + password fallback, Upstash-backed rate limiting, and Vercel-managed cron keep the system production-safe.

## 2. Key Personas & Backing Capabilities
| Persona | Goals | Stack elements backing the story |
| --- | --- | --- |
| **Founder / Product Strategist** | Capture a raw idea during stand-up, star it for prioritisation, and share a spec snapshot. | App Router idea CRUD (`app/dashboard/ideas`), optimistic autosave server actions, `ideas` table ordering + undo, JSON export pipeline in `app/dashboard/ideas/[id]/components`. |
| **Feature Lead / Engineer** | Break an idea into sequenced features, reorder as scope evolves, convert a feature into a full idea when it balloons. | Feature cards rendered via shadcn/ui components, drag-and-drop through `@dnd-kit`, conversion server actions (`ideas`↔`idea_features`), Framer Motion micro-interactions for collapsible detail blocks. |
| **Automation Engineer / AI Agent Author** | Consume idea exports, run codified tasks (tests, scaffolding), push results back as features with evidence. | `docs/idea-import-export-schema.json`, `/api/devmode/jobs` + `/logs/ingest` endpoints, persisted log storage (`dev_logs`), structured task specs under `specs/`. |
| **Runner Operator / Dev Infra** | Pair a local rig with the cloud app, mirror tmux sessions to the browser, keep evidence of every command run. | Electron helper (`apps/runner-desktop`), `@coda/runner-core` with `node-pty`, tmux spawn/attach logic, TLS-friendly packaging (`runner:package-local`), log batching + persistence commits (`62556ee`, `3e078d9`). |
| **Quality / Ops** | Recover from mistakes, audit deleted ideas, verify undo flows, and purge stale data safely. | Soft delete fields in Drizzle schema, undo tokens + Vercel cron (`vercel.json`), Playwright suites under `tests/e2e`, Lighthouse harness `tests/perf/ideas-lighthouse.mjs`. |
| **Compliance / Business Owner** | Keep legal docs versioned, ensure auth flows respect password + magic link policies, maintain analytics and rate limits. | `legal/` Markdown with frontmatter, Auth.js adapters (`@auth/drizzle-adapter`), Upstash ratelimit guardrails, Vercel Analytics instrumentation, environment management in `docs/deploying-to-vercel.md`. |

## 3. Architecture & Stack Rationale
- **Next.js 15 (App Router + Server Actions)** keeps hydration minimal and lets us colocate data mutations with UI. Strict TypeScript plus React 19 concurrency eliminated the hydration bugs we hit mid-project (`612593b`, `0851b02`).
- **Drizzle ORM + drizzle-zod** deliver typed SQL without sacrificing migrations. Using Neon locally and Vercel Postgres in production lets us branch databases, run preview migrations, and keep schema drift out of main.
- **Upstash Redis** provides stateless rate limiting and fits Vercel’s serverless footprint; we avoided self-hosting Redis after early spikes on password reset endpoints.
- **Vercel hosting** gives zero-config App Router SSR, cron jobs (`/api/cron/purge-soft-deletes`), analytics, and per-branch previews. It also aligns with our branch-first workflow—every PR builds a preview we can QA against.
- **Neon / local Postgres**: during early MVP we used Docker Postgres; switching to Neon allowed branching DBs, but we still keep a local Docker fallback (see `README.md`, “Development Workflow”).
- **Tailwind + shadcn/ui + lucide-react** deliver composable design tokens; Framer Motion handles micro-interactions capped at 200 ms to respect prefers-reduced-motion.
- **Runner toolchain**: Electron + node-pty for the companion app, `pkg` for CLI binaries, tmux for session sync, Cloudflare tunnel friendly websockets. Commits `42711fe`, `0bb9458`, `9d652d7` show the evolution through dependency packaging and notarisation.

## 4. Environments, Data, & Operations
- **Environment strategy**: `.env.local` for local dev, GitHub secrets for CI (planned), and Vercel Project variables for preview/prod. `docs/deploying-to-vercel.md` lists the canonical variable set.
- **Database workflow**: Run `pnpm db:generate` + `pnpm db:migrate` against Neon/dev; before promoting to prod, re-run migrations with `DATABASE_URL=<prod>`. Commits `9e04a8c` and `62556ee` highlight migrations for Dev Mode tables and log batching.
- **Rate limiting & analytics**: Upstash handles login, email, and mutation throttling via `@upstash/ratelimit`. Vercel Analytics is auto-instrumented through `@vercel/analytics`, capturing engagement on Dev Mode panels.
- **Cron & housekeeping**: Vercel cron triggers `/api/cron/purge-soft-deletes` daily to purge undo tokens older than seven days—critical for GDPR compliance and to keep search fast.
- **Testing matrix**: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest), `pnpm e2e` (Playwright, now stabilised after login cookie injection), and `pnpm lighthouse`. Evidence assets land in `test-results/` and `evidence/` with gitignore coverage.

## 5. Development Workflow & Version Control
- **Branch-first flow**: All structured work starts from a spec (`specs/00x-*`), then a feature branch (e.g., `feature/runner-patch`). Preview deploys validate changes before merge. This was formalised in commit `f3fff5f`.
- **Spec-driven execution**: Plans live in `.codex/prompts` + `.arguments` and `specs/001-build-a-lightweight/tasks.md`. Agents mark tasks `[ ] → [X]` while running `/implement`.
- **Git history story**:
  - `6be870f` – initial MVP with idea/feature details.
  - `f6ee6d3` – mobile responsiveness improvements.
  - `d5542b9` – legal docs integration.
  - `0b6b640` (tag `V2.0_dmg_helper_app`) – first Dev Mode release with CLI runner.
  - `42711fe` → `9d652d7` – Electron packaging, tmux sync, notarised DMG, culminating in production-ready helper.
  - `62556ee`, `616484b`, `54af461` – reliability passes (log batching, resize suppression, session tracking).
  - Latest commits (`3e078d9`, `4a52066`) tune noise suppression and poll cadence after we noticed excessive `stdin` logs.
- **Pitfalls & Mitigations**:
  - **Hydration flicker** – resolved by deferring legal doc ensures and tightening server/client boundaries (`612593b`, `0851b02`).
  - **Runner packaging loops** – DMG builds initially failed due to workspace symlinks and missing `node-pty` in the ASAR. We added workspace materialisation and notarisation steps (`0bb9458`, `9d652d7`).
  - **Missing API route in production** – `.gitignore` excluded `app/api/devmode/logs/**`. Adding explicit negation ensured combined logs route ships (`.gitignore` update 2025-10-29).
  - **tmux PATH issues** – runner spawned shell without Homebrew path, causing 500s during pairing. Normalising PATH in `runner-core` (`packages/runner-core/src/index.ts`) fixed it.
  - **Log spam** – `stdin` messages flooded activity feed. We now throttle log output and removed generic “[relay] Received message” logging in source (`3e078d9`), though older DMGs still show it.

## 6. Dev Mode & Runner Experience
- **Job lifecycle**: `/api/devmode/jobs` issues idempotent jobs; runner polls, receives a short-lived ingestion token, and mirrors PTY output to `/logs/ingest`. Logs persist in `dev_logs` and surface via `/jobs/:id/logs` and combined day views.
- **Terminal bridge**: The browser uses xterm.js with a WebSocket to the helper; using `TTY_SYNC=tmux` ensures local + remote terminals stay mirrored. Resize throttling (`616484b`) prevents firewall triggers.
- **Runner helper**: Electron app prompts for relay URL, tokens, tmux preference, and auto-starts node-pty. Packaging script `runner:package-local` produces a notarised DMG copied into `public/runner/`.
- **Security posture**: Pairing requires codes approved in the dashboard, Cloudflare Access can protect tunnels, and ingest tokens expire in five minutes. No shell traffic routes through Vercel—only logs.

## 7. Why This Stack & Hosting
- **Vercel**: First-class Next.js support, built-in cron + Analytics, preview deploys that mirror main. We opted against self-hosting to focus engineering time on product features.
- **Neon vs. local Docker**: Neon branchable databases accelerate feature previews; local Docker ensures offline development. Connection resolution order in `lib/db/index.ts` makes it easy to swap.
- **Upstash Redis**: Serverless, pay-per-request, region matched with Vercel. Rate limiting primitives came online in `003-build-out-a` and we have not observed cold-start penalties.
- **Electron helper vs. pure CLI**: Customer testing showed non-terminal teammates needed a GUI to manage pairing/logs, so we kept the CLI as an advanced option but invested in Electron for ease of distribution (see `apps/runner-desktop`).

## 8. Lessons Learned & Future Guardrails
1. **Always inspect `.gitignore` for API subtrees** – the logs API missed production due to an overlooked pattern. New policy: add negated rules immediately when placing server routes under ignored directories.
2. **Bundle-time validation for PATH assumptions** – we now check tmux availability at startup and surface actionable errors rather than logging 500s later.
3. **Preview DB parity matters** – mismatched migrations (e.g., missing `dev_jobs`) caused 503s until we ran `pnpm db:migrate` against the exact connection string the server used (`9e04a8c`).
4. **Electron packaging pipelines need deterministic node_modules** – workspace materialisation script (`apps/runner-desktop/.deploy/scripts/materialize-workspace-deps.js`) prevents symlink drift.
5. **Keep logs meaningful** – after the `[relay] Received message` flood we added batching and severity gating so activity feeds stay useful for operators.

## 9. Agentic Execution Plan (Next Pass)
1. **Document polish & distribution** – Publish this playbook internally (Notion/Confluence) and link it from `README.md` + Dev Mode onboarding.
2. **Runner DMG refresh** – Rebuild the helper with the latest `runner-core` (includes log suppression and PATH fix), re-upload to GitHub release, update `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE`.
3. **Production log parity** – Ensure the updated `/api/devmode/logs/by-idea/...` route deploys to Vercel; add Playwright coverage for the Combined Logs button.
4. **Preview automation** – Wire GitHub Actions to run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, and collect evidence on PRs.
5. **Runner telemetry** – Add metrics (counts per session, failure rates) via Vercel Analytics or a lightweight ClickHouse/Upstash QStash pipeline.
6. **Agent hand-off** – Feed this plan into Codex `/implement` using `.arguments/implement-ideavault.md` so the automation agent can sequence the tasks without re-triaging.

---

_Prepared 2025-10-29 based on repository state `4a52066` and accompanying deployment context._
