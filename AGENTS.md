# Coda Platform Development Guidelines

Auto-generated from active feature plans. Last updated: 2025-10-05

## Active Technologies
- TypeScript 5.x with Next.js App Router (Node runtime)
- Tailwind CSS + shadcn/ui + lucide-react component set
- Framer Motion for premium micro-interactions with prefers-reduced-motion support
- Drizzle ORM + Drizzle Kit with drizzle-zod validation for PostgreSQL
- Auth.js (Credentials + GitHub OAuth) authentication flows
- TypeScript 5.x targeting Next.js 14 App Router + Next.js (App Router RSC + Server Actions), Tailwind CSS + shadcn/ui, Framer Motion, Auth.js (Credentials + GitHub OAuth), Drizzle ORM + drizzle-zod, Upstash Redis rate limiter, Vercel Analytics (001-build-a-lightweight)
- PostgreSQL (Vercel Postgres in prod, Neon for local dev) with Drizzle migrations (001-build-a-lightweight)
- TypeScript 5.x targeting Next.js 14 App Router + Next.js (App Router RSC + Server Actions), Tailwind CSS + shadcn/ui, Framer Motion, Auth.js (GitHub OAuth + Email magic link + dev Credentials), Drizzle ORM + drizzle-zod, Upstash Redis rate limiter, Vercel Analytics (001-build-a-lightweight)

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
- 001-build-a-lightweight: Added TypeScript 5.x targeting Next.js 14 App Router + Next.js (App Router RSC + Server Actions), Tailwind CSS + shadcn/ui, Framer Motion, Auth.js (GitHub OAuth + Email magic link + dev Credentials), Drizzle ORM + drizzle-zod, Upstash Redis rate limiter, Vercel Analytics
- 001-build-a-lightweight: Added TypeScript 5.x targeting Next.js 14 App Router + Next.js (App Router RSC + Server Actions), Tailwind CSS + shadcn/ui, Framer Motion, Auth.js (Credentials + GitHub OAuth), Drizzle ORM + drizzle-zod, Upstash Redis rate limiter, Vercel Analytics
- 001-build-a-lightweight: Added TypeScript 5.x targeting Next.js 14 App Router + Next.js (App Router RSC + Server Actions), Tailwind CSS + shadcn/ui, Framer Motion, Auth.js (Credentials + GitHub OAuth), Drizzle ORM + drizzle-zod, Upstash Redis rate limiter, Vercel Analytics

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
