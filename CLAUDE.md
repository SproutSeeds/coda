# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Coda** is a lightweight product-planning workspace for capturing ideas, shaping them into actionable feature plans, and preparing for agentic delivery pipelines. Built with Next.js 15 (App Router), PostgreSQL, Redis, and Electron for desktop runner companion.

**Core Philosophy**: Distraction-free UI with automation-ready exports. Ideas become structured specs that agents can consume, process, and update programmatically.

---

## Architecture

### Tech Stack
- **Next.js 15.5.4** - App Router with Server Actions for all mutations
- **PostgreSQL** - Neon (dev) / Vercel Postgres (prod) via Drizzle ORM
- **Auth.js** - Email magic links + password fallback
- **Upstash Redis** - Rate limiting via REST API
- **UI**: Tailwind CSS 4, shadcn/ui, Framer Motion, @dnd-kit for drag-and-drop
- **Desktop App**: Electron + Vite + React (in `apps/runner-desktop/`)
- **Shared Logic**: `packages/runner-core` used by both desktop app and CLI

### Project Structure (Monorepo)
```
/
├── app/                      # Next.js App Router
│   ├── dashboard/ideas/      # Main ideas CRUD UI
│   │   ├── actions/          # Server actions (index.ts, import.ts)
│   │   ├── components/       # IdeaCard, FeatureCard, terminals, DevMode
│   │   └── [id]/             # Idea detail page
│   ├── api/                  # REST endpoints (auth, cron, devmode)
│   └── (auth)/               # Auth pages (login, register, verify)
├── lib/
│   ├── db/
│   │   └── schema.ts         # Drizzle schema (ideas, idea_features, auth_*)
│   ├── validations/          # Zod schemas via drizzle-zod
│   └── utils/                # Helpers (autosave, rate limiting, analytics)
├── apps/runner-desktop/      # Electron desktop companion
│   ├── src/
│   │   ├── main/             # Electron main process
│   │   ├── preload/          # Preload scripts
│   │   └── renderer/         # Vite + React UI
│   ├── scripts/              # afterPack-ensure-icon.js
│   └── electron-builder.yml  # Build config for DMG/EXE
├── packages/runner-core/     # Shared runner logic (tmux, PTY, relay)
├── relay/                    # WebSocket relay for terminal connections
├── scripts/
│   ├── generate-runner-icons.mjs  # Icon generation (SVG → ICNS/ICO)
│   └── devmode-runner.ts     # CLI runner (legacy fallback)
├── drizzle/migrations/       # SQL migrations
├── specs/                    # Feature specs (plan.md, tasks.md)
└── tests/
    ├── unit/                 # Vitest unit tests
    ├── e2e/                  # Playwright E2E tests
    └── perf/                 # Lighthouse performance tests
```

### Data Model (lib/db/schema.ts)
- **ideas** - Master records: `id`, `user_id`, `title`, `notes`, `position`, `starred`, `super_starred`, `github_url`, `link_label`, `deleted_at`, `undo_token`, `undo_expires_at`
- **idea_features** - Nested features: `id`, `idea_id`, `title`, `notes`, `detail`, `detail_sections` (JSONB), `position`, `starred`, `completed_at`
- **auth_*** - Standard Auth.js tables (users, accounts, sessions, verification_tokens)

### Server Actions Pattern
All mutations go through server actions in `app/dashboard/ideas/actions/index.ts`:
- Zod validation using schemas from `lib/validations/`
- Rate limiting via Upstash Redis
- Optimistic UI updates in components
- Returns `{ success: boolean, data?, error? }`

---

## Common Development Commands

### Setup & Environment
```bash
# Install dependencies
pnpm install

# Database migrations (run after pulling schema changes)
pnpm db:generate    # Generate migrations from schema.ts
pnpm db:migrate     # Apply migrations to DATABASE_URL

# Generate icons for desktop app (automatically runs during prebuild)
pnpm generate:runner-icons
```

### Development
```bash
# Run Next.js dev server (main web app)
pnpm dev            # http://localhost:3000

# Run desktop companion in dev mode
pnpm --filter @coda/runner-desktop dev
# Launches: Vite renderer + Electron main/preload watch + Electron app

# Run CLI runner (legacy/CI fallback)
pnpm runner:build
node dist/runner/devmode-runner.js
```

### Testing & Quality
```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Unit tests (Vitest)
pnpm test           # Watch mode
pnpm test -- --run  # Single run

# E2E tests (Playwright)
pnpm e2e

# Performance tests
pnpm lighthouse     # Runs against dev server
```

### Building & Packaging
```bash
# Build Next.js for production
pnpm build

# Package desktop app (macOS/Windows/Linux)
cd apps/runner-desktop
pnpm run package    # Outputs to dist/apps/runner-desktop/

# Build CLI runner binaries
pnpm runner:pkg:mac-arm64
pnpm runner:pkg:mac-x64
pnpm runner:pkg:win-x64
pnpm runner:pkg:linux-x64
```

---

## Key Workflows

### Icon Generation (Desktop App)
**Problem Fixed (Oct 2025)**: The `png2icons` npm library generated incomplete 5.3KB ICNS files causing DMG icons to display incorrectly.

**Solution**: `scripts/generate-runner-icons.mjs` now:
1. Generates all 10 required PNG sizes (16x16 through 512x512@2x) in a `.iconset` directory
2. Uses macOS native `iconutil -c icns` to create proper 221KB ICNS files
3. Keeps `png2icons` only for Windows ICO generation

**Automatic**: Runs via `prebuild` script before every desktop app build.

**Location**: `apps/runner-desktop/build/coda-icon.icns`

### Desktop App Signing & Notarization (macOS)
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=true
export APPLE_TEAM_ID=4QV4WR9G32
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"

cd apps/runner-desktop
pnpm run package -- --publish never

# Verify notarization
xcrun stapler staple ../../dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg
xcrun stapler validate ../../dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg
spctl --assess --type exec --verbose "../../dist/apps/runner-desktop/mac-arm64/Coda Runner Companion.app"
```

**Note**: `electron-builder.yml` line 18 references `scripts/afterPack-ensure-icon.js` which ensures icon.icns is copied and Info.plist is updated correctly.

### Autosave Pattern
Components use debounced server actions:
```typescript
const [debouncedValue] = useDebounce(value, 1000);

useEffect(() => {
  void updateIdea({ id, title: debouncedValue });
}, [debouncedValue]);
```
- Shows "Saving..." badge during debounce
- Server action validates, updates DB, returns result
- Component shows success/error toast

### Export/Import Flows
**Export**: Click "Export JSON" on idea detail page → downloads `idea-<id>.json` with:
```json
{
  "idea": { "id": "...", "title": "...", "notes": "...", "features": [...] },
  "features": [{ "id": "...", "title": "...", "notes": "...", "starred": false }]
}
```

**Import**: Dashboard → "Import ideas" → select JSON → resolve duplicates → creates/updates ideas + features

**Schemas**: See `docs/idea-import-export-schema.json` and `docs/idea-import-sample.json`

### Conversion Flows
- **Idea → Feature**: Soft-deletes source idea, adds feature to target idea, issues undo token
- **Feature → Idea**: Creates new idea from feature content, removes feature, navigates to new idea

Both conversions use existing server actions and record analytics events.

### DevMode (Terminal Integration)
**Architecture**: Desktop app runs local tmux sessions, streams I/O through WebSocket relay to browser

**Components**:
- `app/dashboard/ideas/components/TerminalDock.tsx` - Manages multiple terminal panes per idea
- `app/dashboard/ideas/components/TerminalPane.tsx` - Individual xterm.js terminal with connection controls
- `packages/runner-core` - Shared PTY/tmux/relay logic
- `relay/` - WebSocket relay server (typically deployed to Fly.io)

**Pairing Flow**:
1. User installs desktop app or runs CLI runner
2. App requests pairing code from API (`/api/devmode/pair/request`)
3. User approves pairing in web UI (`/dashboard/devmode`)
4. Runner connects to relay with JWT token
5. Browser terminal connects to same relay, attaches to tmux session

**Security**: Pairing tokens are required for relay access; session names are discoverable but access requires valid token.

---

## Environment Variables (Key Ones)

```env
# Database
DATABASE_URL="postgresql://..."           # Postgres connection string

# Auth
NEXTAUTH_SECRET="..."                     # Auth.js session secret
NEXTAUTH_URL="http://localhost:3000"      # Base URL
EMAIL_SERVER="stream"                     # or SMTP URI
EMAIL_FROM="Coda <hello@example.com>"

# Rate Limiting
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Cron Jobs
CRON_SECRET="..."                         # Vercel cron authorization

# DevMode / Relay
NEXT_PUBLIC_DEVMODE_RELAY_URL="wss://relay-falling-butterfly-779.fly.dev"
DEVMODE_JWT_SECRET="..."
NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE="..."    # URL for DMG/EXE downloads
```

See `.env.example` for full list. Mirror all vars in Vercel for deployments.

---

## Testing Strategy

### Unit Tests (Vitest)
- Location: `tests/unit/`
- Focus: Utils, validations, pure functions
- Run: `pnpm test -- --run`

### E2E Tests (Playwright)
- Location: `tests/e2e/`
- Coverage: Auth flows, CRUD, drag-and-drop, conversions
- Run: `pnpm e2e`

### Performance Tests
- Location: `tests/perf/ideas-lighthouse.mjs`
- Metrics: LCP, FID, CLS, TTI
- Run: `pnpm lighthouse` (starts dev server automatically)

**Pre-merge Checklist**:
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test -- --run`
4. (Optional) `pnpm e2e`
5. (Optional) `pnpm lighthouse`

---

## Git Workflow & Commits

### Branch Strategy
- Main branch: `main`
- Feature branches: Descriptive names (e.g., `electron-icon-debugging`)
- Merge to main after testing

### Commit Message Format
Use conventional commits with Claude Code attribution:
```
<type>: <description>

<optional body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Example**:
```
fix: Use macOS iconutil for proper ICNS generation

The png2icons library generated incomplete ICNS files (5.3KB).
Now using native iconutil to create proper 221KB ICNS with all sizes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Styling & UX Conventions

### Interactive Elements
Use `interactive-btn` helper class for subtle grow/tilt effect:
```typescript
className={cn("interactive-btn", ...)}
```
**Do not** reinstate old green hover states.

### Collapsible Sections
- Default: hidden
- Motion durations: ≤ 200ms (respects reduced-motion)
- Example: Feature detail sections, idea notes panels

### Button Variants
- Outline buttons: `hover:bg-primary/5` or `hover:bg-transparent`
- Keep hover states neutral, not green

### Mobile Responsiveness
Use Tailwind breakpoints for stacking:
```typescript
className="flex flex-col gap-2 sm:flex-row sm:items-center"
```
- Recent fix (Oct 2025): DevMode terminal components now stack properly on mobile
- Pattern: `flex-col` on mobile → `sm:flex-row` on tablets+

---

## Specs-Driven Development

The `specs/` folder is the single source of truth for feature planning:

- **Plan**: `specs/<feature>/plan.md` - Strategy, constraints, approach
- **Tasks**: `specs/<feature>/tasks.md` - Checklist (`[ ]` → `[X]`)
- **Contracts**: `specs/<feature>/contracts/*.md` - API shapes, validations
- **Research**: `specs/<feature>/research.md` - Investigation notes

**Workflow**:
1. Update plan when requirements change
2. Break down into tasks
3. Implement with TDD (tests first)
4. Mark tasks complete as you go
5. Update README.md or AGENTS.md when major features land

---

## Known Issues & Gotchas

### Desktop App Icon Generation
- **Issue**: `png2icons` library generates broken ICNS files
- **Fix**: Use `generate-runner-icons.mjs` script (runs automatically during build)
- **Verification**: Check `apps/runner-desktop/build/coda-icon.icns` is >200KB

### Drizzle Migrations
- **Issue**: Migrations can fail if DATABASE_URL is incorrect
- **Fix**: Run `pnpm db:migrate` explicitly; check `.env.local` connection string
- **Tip**: Use Neon for local dev, Vercel Postgres for prod

### Rate Limiting
- **Issue**: Redis connection failures cause 500 errors
- **Fix**: Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- **Tip**: Upstash free tier is sufficient for development

### Terminal Relay
- **Issue**: Desktop app can't connect to relay
- **Fix**: Check `NEXT_PUBLIC_DEVMODE_RELAY_URL` is correct and relay is running
- **Security**: Pairing tokens required; revoke unused pairings

---

## Deployment

### Vercel Setup
1. Connect GitHub repo
2. Set environment variables (mirror `.env.example`)
3. Add cron job in `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/cron/purge-undo", "schedule": "0 8 * * *" }
     ]
   }
   ```
4. Deploy: Automatic on push to `main`

### Database Migrations
- **Development**: Run manually via `pnpm db:migrate`
- **Production**: Auto-runs in postbuild if `VERCEL_ENV === "production"`

### Desktop App Releases
1. Tag repo: `runner-desktop-vX.Y.Z`
2. GitHub Actions builds DMG/EXE/AppImage/DEB
3. Upload artifacts to release hosting
4. Update `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE` env var

---

## Additional Resources

- **README.md** - Full feature list, user personas, architecture diagrams
- **AGENTS.md** - Agent integration guide (if exists)
- **specs/** - Feature specifications and task lists
- **docs/** - JSON schemas, relay protocol, sample payloads
