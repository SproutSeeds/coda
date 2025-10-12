# Implementation Plan: Custom Light & Dark Mode Preferences

**Branch**: `002-create-custom-gorgeously` | **Date**: 2025-10-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-create-custom-gorgeously/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (default: Next.js web app)
   → Set Structure Decision based on constitution-mandated layout
3. Fill the Constitution Check section using the latest constitution mandates.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (run `.specify/scripts/bash/update-agent-context.sh codex`)
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

## Summary
Users need a minimalist, accessible theme toggle inside Account settings that defaults to dark mode with an onboarding prompt, persists preferences per user, honors OS high-contrast settings, and guarantees WCAG AA readability while staying within the constitution’s performance and stack mandates.

## Technical Context
**Language/Version**: TypeScript 5.x (strict)  
**Primary Dependencies**: Next.js 15 App Router, Tailwind CSS + shadcn/ui, Framer Motion, lucide-react, next-themes, drizzle-orm + drizzle-zod  
**Storage**: PostgreSQL (Neon/Vercel Postgres) via Drizzle migrations  
**Testing**: Vitest (unit), Playwright (E2E), Lighthouse CLI  
**Target Platform**: Vercel-hosted web app  
**Project Type**: Single Next.js web application (App Router)  
**Performance Goals**: LCP < 2.5s, CLS ≈ 0, Lighthouse ≥ 90 across categories, motion transitions 150–200 ms  
**Constraints**: Auth.js (magic links + credentials), WCAG AA contrast, theme persistence must survive multi-device usage, respect OS high-contrast  
**Scale/Scope**: Single-user preference (≤1 row per user); negligible data volume but must be atomic and resilient

## Constitution Check
- Stack aligns with mandated Next.js App Router + strict TypeScript, Tailwind, shadcn/ui, lucide-react.
- Data persistence uses Drizzle ORM with migrations and drizzle-zod schemas.
- Deployment remains on Vercel with existing CI (pnpm lint/typecheck/build) untouched.
- Environment variables unchanged; Auth.js flows preserved with bcrypt ≥ 12.
- Quality gates honored: plan includes Vitest/Playwright coverage and Lighthouse smoke tests for both themes.
- Accessibility & performance mandates met: WCAG AA contrast, Framer Motion polish <200 ms, no CLS regressions.
- No exceptions or alternative stacks required; no Complexity Tracking entries needed.

**Initial Constitution Check**: PASS

## Project Structure

### Documentation (this feature)
```
specs/002-create-custom-gorgeously/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── theme-preference.md
└── spec.md
```

### Source Code (repository root)
```
app/
├── (public routes, Account settings page, Server Actions)
components/
├── (shared theme toggle, shadcn/ui wrappers)
lib/
├── auth/
├── db/
│   ├── schema.ts (Drizzle models)
│   └── migrations/
├── validations/
└── utils/
public/
styles/
scripts/
```

**Structure Decision**: Maintain constitution-mandated layout; theme toggle lives in `components/`, Account Server Actions in `app/dashboard/account/`, data access in `lib/db/` with new Drizzle migration.

## Phase 0: Outline & Research
Delivered in `research.md`. Key resolutions:
1. Use `theme_preferences` table for durable per-user storage.
2. Employ `next-themes` for SSR-friendly theme switching.
3. Define shared color tokens and automated contrast verification.
4. Respect `forced-colors: active` to defer to OS high-contrast settings.
5. Implement 10-second onboarding prompt on first load without preference.

**Phase 0 Output**: [research.md](./research.md)

## Phase 1: Design & Contracts
Artifacts produced:
- **Data Model**: [data-model.md](./data-model.md) describing `theme_preferences` schema and relationships.
- **Contract**: [contracts/theme-preference.md](./contracts/theme-preference.md) for the `updateThemePreference` Server Action.
- **Quickstart**: [quickstart.md](./quickstart.md) outlining validation workflow.
- **Agent Context Update**: `.specify/scripts/bash/update-agent-context.sh codex` executed to sync decisions.

Design highlights:
- Upsert Server Action writes to `theme_preferences` with validation via drizzle-zod.
- UI toggle is client component backed by `next-themes` for instant updates.
- High-contrast detection implemented via CSS + JS check with analytics logging.

**Post-Design Constitution Check**: PASS (no new violations).

## Phase 2: Task Planning Approach
- `/tasks` will derive work items from contracts & data model.
- Order of operations: migrations → drizzle schema updates → Zod schema → Server Action + tests → UI toggle + prompt → E2E tests → Lighthouse verification.
- Tests-first philosophy: generate Vitest unit tests for Server Action and Playwright flows before implementation.
- Tag parallelizable tasks (e.g., UI polishing vs. telemetry logging) with `[P]`.

## Phase 3+: Future Implementation
- `/tasks` generates detailed checklist.
- Dev executes tasks with TDD and CI gates.
- Validation runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, `pnpm lighthouse` per Definition of Done.

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | – | – |

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
