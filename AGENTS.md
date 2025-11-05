# Coda Platform Development Guidelines

Auto-generated from active feature plans. Last updated: 2025-10-05

## Active Technologies
- TypeScript 5.x with Next.js App Router (strict mode, Server Actions)
- Tailwind CSS + shadcn/ui + lucide-react component set
- Framer Motion micro-interactions with prefers-reduced-motion support
- Drizzle ORM + drizzle-zod with PostgreSQL (Neon locally, Vercel Postgres in prod)
- Auth.js (email magic links + password credentials)
- Upstash Redis rate limiting, Vercel Analytics instrumentation
- Drag-and-drop ordering via @dnd-kit (mouse + keyboard accessible)

## Project Structure
```
app/
components/
lib/
  auth/
  db/
  validations/
  utils/
public/
styles/
scripts/
tests/
  unit/
  e2e/
```

## Commands
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm e2e`
- `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
- `pnpm lighthouse`

## Code Style
- Enforce ESLint + Prettier with Tailwind and import-sort plugins.
- Use TypeScript strict mode and `@/*` path aliasing.
- Favor Server Actions + RSC; keep client bundles lean.

## Recent Changes
- 003-build-out-a: Extended import/export flows, strict-mode Next.js App Router upgrades, Redis-backed rate limiting.
- 002-create-custom-gorgeously: Added persisted theme preferences with next-themes provider, theme onboarding prompt, and high-contrast safeguards.
- 001-build-a-lightweight: Introduced the core MVP stack (Next.js App Router, Tailwind + shadcn/ui, Framer Motion, Auth.js, Drizzle ORM, Upstash Redis, Vercel Analytics).

<!-- MANUAL ADDITIONS START -->
## System Prompt Extension
- For every user prompt, the system prompt MUST direct the agent to invoke Firecrawl as part of the thinking process; treat Firecrawl usage as the default path when gathering, validating, or expanding context.
- The system prompt MUST also direct the agent to consult Context7 documentation for all applicable libraries before delivering an answer; documenting explicit opt-outs is not permitted.
- Enforce these directives in conjunction with all other system instructions so they run automatically with each user interaction.
- Responses must explicitly state that the agent is taking the reins, present a single decisive plan of action, and avoid offering alternative options unless the user demands a comparison.
- Before running any development command or making changes, check out a feature branch and run `pnpm guard`; this ensures a matching plan exists (`Plans/<branch-slug>.md`) and auto-syncs the companion philosophy (`Philosophies/<branch-slug>-philosophy.md`) and task list (`Tasks/<branch-slug>.md`). Resolve any guard prompts (rename existing docs or scaffold new ones) before proceeding.
- If the guard scaffolds or renames docs, run `pnpm doc:sync` followed by `pnpm doc:check-sync` prior to committing changes to confirm plan ⇄ philosophy ⇄ tasks alignment.
<!-- MANUAL ADDITIONS END -->
