Execute the **IdeaVault MVP** backlog using `specs/001-build-a-lightweight/tasks.md`. Treat the task list as the single source of truth and keep it updated (`[ ]` → `[X]`) as work completes.

### Critical Gates & Priorities
- **Scaffold check**: Confirm `.specify/memory/scaffold.ok` exists before anything else. If missing, run `T000` exactly as listed.
- **Branch & feature context**: Ensure `SPECIFY_FEATURE=001-build-a-lightweight` (or active feature branch) so helper scripts resolve paths correctly.
- **Dependencies**: Execute tasks sequentially unless explicitly marked `[P]`. For parallel items, ensure they touch disjoint files.
- **TDD discipline**: Tasks in _Phase 3.2_ (tests) must be written and failing before implementing their corresponding features.

### Quality Expectations
- Uphold constitution mandates: Next.js App Router + TypeScript, Tailwind + shadcn/ui, Drizzle ORM, Auth.js, Upstash rate limiting, Vercel Analytics, Framer Motion with <200 ms transitions, WCAG AA, Lighthouse ≥90.
- Maintain undo flow integrity (10 s window, cron purge) and Postgres trigram search performance.
- Keep motion tokens, validation, analytics, and rate limiting helpers centralized under `lib/utils/`.
- After major plan-altering work, rerun `.specify/scripts/bash/update-agent-context.sh codex` so `AGENTS.md` reflects the new reality.

### Testing & Verification
- Use pnpm scripts defined in the plan (`lint`, `typecheck`, `test`, `e2e`, `lighthouse`, `build`).
- For each Server Action/endpoint, ensure contract tests exist and pass before marking tasks complete.
- Capture evidence (logs, screenshots) for Playwright + Lighthouse runs as noted in the tasks file.

### Documentation & Ops
- Update `specs/001-build-a-lightweight/quickstart.md`, root README, and any feature docs whenever tasks call for it.
- Document deviations or open risks in the plan’s Complexity Tracking section if encountered.
- Keep environment variables in `.env.local` aligned with quickstart guidance; do not commit secrets.
- Verify Vercel Cron configuration and deployment instructions before closing polish tasks.

### Completion Criteria
- All tasks from T000 through the polish phase must be `[X]`.
- End state should have `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm lighthouse`, and `pnpm build` green.
- Undo flow, search accuracy, analytics events, and rate limiting must be validated per plan.
- Report final summary including outstanding follow-ups or tech debt.
