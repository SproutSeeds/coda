# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

### Development
- `pnpm dev` – Start Next.js dev server (default: `http://localhost:3000`)
- `pnpm lint` – Run ESLint checks
- `pnpm typecheck` – Run TypeScript type checking without emitting files
- `pnpm test` – Run Vitest unit tests
- `pnpm e2e` – Run Playwright end-to-end tests
- `pnpm lighthouse` – Run Lighthouse performance audit against dev server

### Database
- `pnpm db:generate` – Generate Drizzle migrations from schema changes
- `pnpm db:migrate` – Apply pending migrations to database
- Combined: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`

### Build & Deploy
- `pnpm build` – Production build
- `pnpm start` – Start production server

### Runner Companion (Dev Mode)
- `pnpm runner:build` – Compile TypeScript runner to `dist/runner/`
- `pnpm runner:pkg:mac-arm64` – Package CLI binary for macOS ARM64
- `pnpm --filter runner-desktop dev` – Run desktop app in development
- `pnpm --filter runner-desktop package -- --publish never` – Build & package desktop app

## Architecture Overview

### Stack
- **Framework**: Next.js 15 App Router with Server Actions, React 19, TypeScript 5 (strict mode)
- **Database**: PostgreSQL (Neon local, Vercel Postgres prod) via Drizzle ORM
- **Auth**: Auth.js with email magic links + password credentials
- **UI**: Tailwind CSS 4, shadcn/ui, lucide-react, Framer Motion, Sonner toasts
- **Rate Limiting**: Upstash Redis (with in-memory fallback)
- **Drag & Drop**: @dnd-kit (keyboard + mouse accessible)
- **Analytics**: Vercel Analytics server-side tracking

### Key Directories
```
app/
  dashboard/          # Authenticated routes (ideas, suggestions, account, devmode)
    ideas/
      actions/        # Server actions for CRUD (index.ts, import.ts)
      [id]/           # Idea detail page
    suggestions/      # Community suggestions board
    devmode/          # Terminal companion pairing & downloads
  (public)/           # Unauthenticated routes (login, legal, onboarding)
  api/
    auth/             # Auth.js handlers
    cron/             # Vercel Cron (undo purge)
    devmode/          # WebSocket relay endpoints (pair, sessions, logs)
components/
  ui/                 # shadcn/ui primitives
lib/
  auth/               # Session helpers, Auth.js config
  db/                 # Schema (schema.ts), query builders (ideas.ts, features.ts)
  validations/        # Zod + drizzle-zod schemas
  utils/              # analytics.ts, rate-limit.ts, undo.ts
  devmode/            # JWT session/runner token helpers
packages/
  runner-core/        # Shared PTY logic (desktop + CLI runner)
apps/
  runner-desktop/     # Electron app (main, preload, renderer)
relay/                # Fly.io WebSocket relay (separate deploy)
scripts/              # devmode-runner.ts (CLI fallback), generate-runner-icons.mjs
specs/                # Feature plans (plan.md, tasks.md per feature)
legal/                # Terms, Privacy Policy, DPA
docs/                 # Architecture notes (dev-mode-relay.md, runner-packaging.md)
```

### Data Model (Drizzle Schema)
- **ideas**: `id`, `userId`, `title`, `notes`, `linkLabel`, `githubUrl`, `position`, `starred`, `superStarred`, `deletedAt`, undo fields
- **idea_features**: `id`, `ideaId`, `title`, `notes`, `detail`, `detailSections` (JSONB), `position`, `starred`, `superStarred`, `completed`, `deletedAt`
- **suggestions**: Community suggestions table (similar to ideas but with `ownerId`, `submittedBy`)
- **suggestion_updates**: Comment/update threads for suggestions
- **auth_***: Auth.js tables (users, accounts, sessions, verification_tokens)
- **theme_preferences**: Per-user theme + prompt dismissal state
- **document_acceptances**: Terms/Privacy acceptance tracking

#### Key Patterns
- **Soft deletes**: `deletedAt` timestamp + undo tokens (10s expiry)
- **Drag-and-drop ordering**: `position` (double precision) for fractional indexing
- **Autosave**: Debounced server actions with optimistic UI
- **Rate limiting**: Per-user, per-action keys (e.g., `{userId}:create`, `{userId}:search`)

### Server Actions
All mutations live in `app/dashboard/*/actions/index.ts`:
- **Ideas**: `createIdeaAction`, `updateIdeaAction`, `deleteIdeaAction`, `restoreIdeaAction`, `reorderIdeasAction`, `cycleIdeaStarAction`, `exportIdeaAsJsonAction`, `exportAllIdeasAsJsonAction`, `importIdeasAction`
- **Features**: `createFeatureAction`, `updateFeatureAction`, `deleteFeatureAction`, `restoreFeatureAction`, `reorderFeaturesAction`, `cycleFeatureStarAction`, `setFeatureCompletionAction`
- **Conversions**: `convertIdeaToFeatureAction`, `convertFeatureToIdeaAction`
- **Suggestions**: Similar CRUD + update threads

All actions:
1. Call `requireUser()` to enforce auth
2. Apply rate limiting via `consumeRateLimit(key)`
3. Execute DB mutation via `lib/db/*` query builders
4. Track analytics via `trackEvent({ name, properties })`

### Import/Export Flow
- **Export**: Click "Export JSON" on idea detail → downloads `idea-<id>.json` with envelope:
  ```json
  {
    "schemaVersion": 1,
    "exportedAt": "...",
    "ideaCount": 1,
    "featureCount": N,
    "ideas": [{ "idea": {...}, "features": [...] }]
  }
  ```
- **Import**: Upload JSON bundle → preview dialog → choose "Update existing" or "Create new" for duplicates → confirm → server validates, deduplicates, and inserts/updates
- **Schema**: `docs/idea-import-export-schema.json` + sample in `docs/idea-import-sample.json`

### Dev Mode (Terminal Companion)
- **Purpose**: Launch PTY sessions from the browser, sync with tmux on user's machine
- **Architecture**:
  - **Relay** (Fly.io): WebSocket broker at `wss://relay-falling-butterfly-779.fly.dev`
  - **Runner** (Desktop app or CLI): Connects to relay with JWT runner token
  - **Client** (Browser): Mints session token via `/api/devmode/sessions`, connects to relay
- **Pairing**:
  1. Runner calls `POST /api/devmode/pair/start` → displays short code
  2. User approves in UI → `POST /api/devmode/pair/approve`
  3. Runner polls `GET /api/devmode/pair/check` → receives `{ relayUrl, runnerId, runnerToken }`
  4. Token stored locally (Electron Store or `~/.config/coda-runner/config.json`)
- **Security**: Pairing is the trust boundary; session names are public but require valid token to attach
- **Logs**: PTY output mirrored to `/api/devmode/logs/ingest` when recording enabled
- **Env vars**:
  - App: `NEXT_PUBLIC_DEVMODE_RELAY_ENABLED=1`, `DEVMODE_RELAY_URL`, `DEVMODE_JWT_SECRET`, `RELAY_INTERNAL_SECRET`
  - Runner: `RELAY_URL`, `RUNNER_TOKEN`, `TTY_SYNC=tmux`, `TTY_CWD`

## Development Workflow

### First-Time Setup
1. Clone repo, run `pnpm install`
2. Copy `.env.example` to `.env.local`, populate:
   - `DATABASE_URL` (Neon connection string)
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `EMAIL_SERVER`, `EMAIL_FROM` (magic links)
3. Run `pnpm db:migrate` to apply schema
4. Start dev server: `pnpm dev`
5. Open `http://localhost:3000/login`

### Adding a Feature
1. Create or update `specs/<feature-name>/plan.md` and `tasks.md`
2. Update schema in `lib/db/schema.ts` if needed → `pnpm db:generate` → `pnpm db:migrate`
3. Write tests first (TDD): unit tests in `tests/unit/`, E2E in `tests/e2e/`
4. Implement server actions in `app/dashboard/*/actions/index.ts`
5. Add UI components (prefer Server Components; mark `"use client"` only when needed)
6. Run pre-merge checks:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test -- --run`
   - `pnpm e2e` (optional)
7. Update `AGENTS.md` if notable changes affect AI/automation context

### Testing Strategy
- **Unit**: Vitest for `lib/` utilities, validations, pure functions
- **E2E**: Playwright for auth flows, CRUD, drag-and-drop, conversion scenarios
- **Performance**: `pnpm lighthouse` before production merges
- **Test a single file**: `pnpm test <path/to/test.test.ts>`

### Code Style
- ESLint + Prettier enforce formatting (Tailwind plugin, import-sort)
- TypeScript strict mode required
- Use `@/*` path aliases (defined in `tsconfig.json`)
- Prefer Server Actions + RSC over client-side data fetching
- Interactive elements: use `interactive-btn` helper from `lib/utils.ts` for consistent grow/tilt effect
- Collapsible sections: default to hidden, keep motion durations ≤ 200ms

## Common Patterns

### Creating a New Server Action
```typescript
// app/dashboard/things/actions/index.ts
export async function createThingAction(data: { title: string }) {
  const user = await requireUser();
  const key = `${user.id}:create`;
  const rate = await consumeRateLimit(key);
  if (!rate.success) throw new Error("Rate limit exceeded.");
  
  const thing = await createThing(user.id, data);
  await trackEvent({ name: "thing_created", properties: { thingId: thing.id } });
  return thing;
}
```

### Autosave Pattern
1. Client component: `const [debouncedValue] = useDebounce(value, 500)`
2. `useEffect(() => { updateThingAction({ id, ...debouncedValue }) }, [debouncedValue])`
3. Optimistic UI: Show "Saving..." badge while action in flight

### Soft Delete + Undo
- Mutation: Call `softDeleteThing(...)` with undo token, return `{ undoToken, expiresAt }`
- UI: Show toast with "Undo" button that calls `restoreThingAction({ id, token })`
- Cron: `/api/cron/purge-undo` runs daily to purge expired soft-deleted records

### Drag-and-Drop Reordering
- Use `@dnd-kit/sortable` with `useSortable` hook
- On drop: Compute new `position` (fractional index between neighbors), call `reorderThingsAction(ids)`
- See `app/dashboard/ideas/components/IdeaList.tsx` for reference

## Deployment

### Vercel Setup
1. Connect GitHub repo to Vercel project
2. Set environment variables (mirror `.env.local`):
   - `DATABASE_URL` (Vercel Postgres)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
   - `CRON_SECRET` (for undo purge)
   - `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEVMODE_RELAY_URL`, `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE`
3. Add `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/cron/purge-undo", "schedule": "0 8 * * *" }
     ]
   }
   ```
4. Deploy: `git push` triggers automatic deploy

### Relay Deployment (Fly.io)
1. `cd relay && fly launch`
2. `fly secrets set DEVMODE_JWT_SECRET=<shared-with-app>`
3. `fly deploy`
4. Set `DEVMODE_RELAY_URL` in Vercel to `wss://<app>.fly.dev`

### Runner Releases
- **Desktop**: Tag repo `runner-desktop-vX.Y.Z` → GitHub Actions builds DMG/EXE/AppImage
- **CLI**: Run `pnpm runner:pkg:mac-arm64` (or other platforms) → upload binaries to `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE`

## Key Files to Review
- `lib/db/schema.ts` – Single source of truth for data model
- `lib/auth/session.ts` – Auth helpers, session management
- `app/dashboard/ideas/actions/index.ts` – Reference for server action patterns
- `lib/utils/rate-limit.ts` – Rate limiting logic (Upstash + fallback)
- `lib/utils/undo.ts` – Undo token management
- `docs/dev-mode-relay.md` – Dev Mode architecture deep-dive
- `AGENTS.md` – AI/automation context, recent changes

## Environment Variables Reference
| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_SECRET` | Auth.js session encryption key | Yes |
| `NEXTAUTH_URL` | Base URL for auth callbacks | Yes |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | Yes |
| `EMAIL_SERVER` | SMTP URI or `"stream"` | Yes |
| `EMAIL_FROM` | Sender address for magic links | Yes |
| `CRON_SECRET` | Bearer token for Vercel Cron | Production |
| `NEXT_PUBLIC_DEVMODE_RELAY_ENABLED` | Enable relay UI (1/0) | Optional |
| `DEVMODE_RELAY_URL` | WebSocket relay URL | Dev Mode |
| `DEVMODE_JWT_SECRET` | Shared secret for runner/session tokens | Dev Mode |
| `RELAY_INTERNAL_SECRET` | Relay → app verification header | Dev Mode |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for app | Production |
| `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE` | Download links for runner installers | Optional |

## Troubleshooting
- **Rate limit fallback**: If `UPSTASH_REDIS_REST_*` missing/invalid, in-memory store is used (dev only)
- **Undo tokens**: 10-second expiry; refresh `expiresAt` on restore failures
- **Migrations**: Always run `pnpm db:migrate` after pulling schema changes
- **Dev Mode pairing**: Runner must poll `/api/devmode/pair/check` until approved; check logs for JWT/relay issues
