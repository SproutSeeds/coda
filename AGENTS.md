# Coda Platform Development Guidelines

Auto-generated from active feature plans. Last updated: 2025-10-05

## Active Technologies
- TypeScript 5.x with Next.js App Router (Node runtime)
- Tailwind CSS + shadcn/ui + lucide-react component set
- Framer Motion for premium micro-interactions with prefers-reduced-motion support
- Drizzle ORM + Drizzle Kit with drizzle-zod validation for PostgreSQL
- Auth.js (Credentials + GitHub OAuth) authentication flows

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
- (2025-10-05) IdeaVault MVP planning added idea CRUD/search scope, undo workflow, analytics instrumentation, and search/index research tasks.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
