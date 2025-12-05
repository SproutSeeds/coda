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
  - Firecrawl: Use only when external web context is genuinely needed (e.g., fresh info not in-repo or not provided). If the needed
    context is already available locally or in the prompt, skip Firecrawl.
  - Context7 docs: Consult when library docs are relevant to the task; skip when not applicable.
  - Apply these rules alongside all other system instructions on every turn.
  - Present one decisive plan of action, and avoid alternatives unless the user explicitly
    asks for a comparison.
<!-- MANUAL ADDITIONS END -->
