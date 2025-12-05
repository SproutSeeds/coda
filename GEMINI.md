# GEMINI.md

Instructions for Gemini when working in this repository.

---

## Core Principles

1. **SIMPLICITY IS EVERYTHING** - Every change should impact as little code as possible
2. **NEVER BE LAZY** - Find root causes, no temporary fixes, no shortcuts
3. **NO BUGS** - Simple changes = fewer bugs. You are a senior developer.

### What NOT To Do
- No massive or complex changes
- No temporary fixes or workarounds
- No changes beyond what's necessary for the task
- No guessing - read the code first

---

## Task Execution Protocol

### Before Writing Code
1. **Think through the problem**
2. **Read relevant files** - Explore the codebase, understand existing patterns
3. **Write a plan** (optionally using `Tasks/<feature-name>.md` for complex tasks)
4. **Stop and check in with user** - Get plan verification before any code changes

### During Implementation
5. **Narrate your progress** - High-level explanation after each change
6. Keep changes minimal - only touch code necessary for the task
7. **Verify changes work** - Run typecheck/lint/test as appropriate

---

## Essential Commands

```bash
pnpm dev            # Start dev server (localhost:3000)
pnpm typecheck      # Type checking
pnpm lint           # Linting
pnpm test           # Unit tests
```

---

## Project Structure

```
app/                  # Next.js App Router (pages, server actions)
lib/                  # Core logic (db, auth, utils, validations)
components/           # Shared UI components
drizzle/migrations/   # Database migrations
Tasks/                # Task tracking files
Philosophies/         # Design decision documents
docs/                 # Detailed documentation
```

---

## Git Workflow

1. **Always work on feature branches** - never commit directly to `main`
2. Create branch: `git checkout -b feat/<name>` or `fix/<name>`
3. Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`

---

## Key Patterns

- **Server Actions**: All mutations in `app/dashboard/ideas/actions/`
- **Database**: Drizzle ORM, schema in `lib/db/schema.ts`
- **Auth**: Auth.js with email magic links
- **Styling**: Tailwind CSS + shadcn/ui + Framer Motion

---

## Where to Find Details

| Topic | Location |
|-------|----------|
| Architecture | `docs/` |
| Feature specs | `Philosophies/` |
| Environment vars | `.env.example` |
| Database schema | `lib/db/schema.ts` |
| API patterns | `app/api/` |
