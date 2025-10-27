# Coda Platform

A lightweight product-planning workspace for capturing ideas, shaping them into actionable feature plans, and preparing the ground for a fully agentic delivery pipeline. Coda pairs a distraction-free UI with modern automation primitives—server actions, export hooks, and conversion flows—so teams can move from concept to execution without leaving the app and keeping all technology in-house and proprietary.

---

## Why Coda?

| Problem | How Coda Helps |
| --- | --- |
| Ideas live in docs, tickets, and chat threads where they quickly lose context. | Each idea opens into a structured brief with autosaving sections, feature breakdowns, and source-of-truth IDs. |
| Teams struggle to prioritise or reorganise fast enough to keep pace with changing priorities. | Drag-and-drop reordering (mouse, touch, keyboard) keeps the roadmap fluid while maintaining audit trails and undo support. |
| Product specs rarely stay aligned with implementation once engineers start building. | Server actions enforce a single source of truth, exports snap the current idea/feature tree into JSON, and conversion tools keep the artefacts in sync. |
| Agentic workflows are hard to adopt because systems are expensive and closed. | Coda is intentionally cheap to run (Next.js + Postgres + Redis free tiers) and connector-friendly via JSON exports, so external automation can integrate without lock‑in. |

We are designing toward a fully agentic product-development assistant: human-friendly on the surface, automation-ready underneath. Today, Coda acts as the staging ground where ideas become specs; tomorrow, agents will consume these specs, run tests, and ship updates end-to-end.

---

## Key Features

- **Ideas dashboard** – minimal cards with search, star filters, and persistent drag-and-drop ordering. Recently deleted ideas stay recoverable for seven days.
- **Idea detail view** – autosaved title, core plan, and link metadata with collapsible sections and smooth Framer Motion transitions. Includes JSON export, convert-to-feature, and undo flows.
- **Feature breakdowns** – every feature card supports inline autosave, drag-and-drop reordering, multi-section detail blocks, and conversion back into a full idea.
- **Authentication** – Auth.js email magic links plus password-first sign-up/sign-in fallback, with admin capabilities keyed to the `DEVELOPER_EMAIL` constant.
- **Rate-limited workflows** – Upstash Redis keeps email and mutation flows safe; server actions wrap each critical mutation.
- **Undo + lifecycle** – Soft deletes issue undo tokens, and a Vercel cron job purges expired items daily.
 
- **One-click JSON export** – download a structured idea + features payload to seed downstream services, LLM runs, or connector APIs.

## Legal Documents

Canonical copies of our Terms of Service, Privacy Policy, and Data Processing Addendum live in `legal/`. Update the frontmatter version/date when a change ships and ensure the app prompts users to accept the latest version.

---

## User Personas & Stories

| Persona | Story |
| --- | --- |
| **Founder / PM** | “Capture an idea during a stand-up, star it for later, and export the JSON to brief an external agent.” |
| **Tech lead** | “Split a high-level idea into features, reorder them by priority, and convert an exploratory feature into its own idea when scope expands.” |
| **Automation engineer** | “Subscribe to JSON exports, feed them into your automation, and post results back as new features or updates.” |
| **QA / Ops** | “Use the recently deleted drawer and undo tokens to keep history clean without losing auditability.” |

---

## Architecture Overview

```
Next.js 15 (App Router, Server Actions)
│
├── Authentication: Auth.js + email magic links + password-first fallback
├── Persistence: PostgreSQL (Neon local / Vercel Postgres prod) via Drizzle ORM
├── Queues / Rate limiting: Upstash Redis REST
├── UI: Tailwind CSS + shadcn/ui + lucide-react icons + Framer Motion transitions
├── Drag & drop: @dnd-kit for ideas + features ordering
├── Notifications: Sonner toasts
└── Agent tooling: (optional; bring your own)
```

- **Server actions** handle every mutation (`app/dashboard/ideas/actions/index.ts`).
- **Validations** live in `lib/validations/*` using `drizzle-zod` and Zod for runtime safety.
- **Autosave** uses debounced server actions with optimistic UI and status badges.
- **Exports** serialise the live idea + features payload; no extra API is required.
- **Conversion flows** reuse existing CRUD primitives (idea↔feature) to keep data in sync.

---

## Data Model

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `ideas` | Master record for an idea/spec. | `id`, `user_id`, `title`, `notes`, `link_label`, `github_url`, `position`, `starred`, `deleted_at`, undo fields. |
| `idea_features` | Feature cards nested under an idea. | `id`, `idea_id`, `title`, `notes`, `position`, `starred`. |
| `auth_*` | Auth.js tables (users, accounts, sessions, verification tokens). | Standard Auth.js schema. |

New migrations:
- `0007_add_starred_to_features.sql`
- `0008_add_link_label_to_ideas.sql`

Run `pnpm db:migrate` any time migrations change.

---

## Development Workflow

1. **Clone & install**
   ```bash
   git clone https://github.com/SproutSeeds/coda.git
   cd coda
   pnpm install
   ```
2. **Configure environment** (see `.env.example`). Minimum variables:
   ```env
   DATABASE_URL="postgres://postgres:postgres@localhost:5432/coda"
   NEXTAUTH_SECRET="..."
   NEXTAUTH_URL="http://localhost:3000"
   UPSTASH_REDIS_REST_URL="..."
   UPSTASH_REDIS_REST_TOKEN="..."
   EMAIL_SERVER="stream"   # or SMTP URI
   EMAIL_FROM="Coda <hello@example.com>"
  ```
3. **Database** – run `pnpm drizzle-kit generate && pnpm drizzle-kit migrate` (Neon/Vercel Postgres URLs work too).
4. **Run locally** – `pnpm dev` then open `http://localhost:3000/login`.
5. **QA** – `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm playwright test`, `pnpm lighthouse`.
6. **Agent tooling (optional)** – integrate your preferred automation; exports/imports are designed to be machine‑friendly.
7. **Deploy** – Vercel project with Postgres + Upstash Redis. Add cron entry in `vercel.json` for `/api/cron/purge-soft-deletes`.

---

## Development Rhythm

Use the `specs/` folder as the single source of truth:

- Plan: update `specs/<feature>/plan.md` as constraints or strategy shift.
- Tasks: keep `specs/<feature>/tasks.md` current as work completes (`[ ]` → `[X]`).
- Implement: follow tasks with TDD (tests first), then code, then polish.
- Sync: refresh `AGENTS.md` when notable plan/code changes land so tooling/docs stay aligned.

---

## Exporting Ideas

- Open an idea (`/dashboard/ideas/[id]`).
- Click **Export JSON** (grows/tilts per design, no green highlight).
- Coda downloads `idea-<id>.json` with shape:
  ```json
  {
    "idea": { "id": "...", "title": "...", "notes": "...", "linkLabel": "GitHub Repository", ... },
    "features": [
      { "id": "...", "title": "...", "notes": "...", "starred": false, ... }
    ]
  }
  ```
- Use this payload to bootstrap connectors, LLM agents, or downstream specs.

---

## Importing Ideas

- Click **Import ideas** on the Ideas dashboard (adjacent to **Export all ideas**).
- Select a JSON bundle produced by the export flow. The preview dialog summarises how many ideas/features are new, updated, or unchanged.
- For duplicate titles, pick **Update existing** or **Create new**. Use the **Apply to all** control to cascade the current decision across every duplicate.
- Confirm the import. Success toasts list created/updated counts; errors display a red toast with diagnostics and no data mutations.
- Re-import a previous export to restore the workspace or seed another environment.

### JSON Schema & Sample Payload

- **Sample**: `docs/idea-import-sample.json` shows a one-idea export with three nested features—it matches what the UI downloads.
- **Schema**: `docs/idea-import-export-schema.json` captures the contract (envelope fields, idea/feature shapes). Highlights:
  - Top level: `schemaVersion`, `exportedAt`, `ideaCount`, `featureCount`, `ideas[]`.
  - Each entry in `ideas[]` contains an `idea` object and a `features[]` collection.
  - Optional nullable fields (`githubUrl`, `deletedAt`, `completedAt`) stay explicit to avoid ambiguity at import time.

A trimmed excerpt of the sample payload:

```jsonc
{
  "schemaVersion": 1,
  "ideaCount": 1,
  "featureCount": 4,
  "ideas": [
    {
      "idea": { "id": "coda-aurora-0001", "title": "Coda Aurora Initiative", "starred": true },
      "features": [
        { "id": "aurora-telescope", "title": "Telemetry Telescope", "starred": true },
        { "id": "aurora-fieldguide", "title": "Field Guide Narratives" },
        { "id": "aurora-signalflare", "title": "Signal Flare Automations", "starred": true },
        { "id": "aurora-compass", "title": "Roadmap Compass" }
      ]
    }
  ]
}
```

---

## Conversion Flows

| Action | Entry Point | Result |
| --- | --- | --- |
| Idea → Feature | Idea detail → **Convert to feature** button | Soft-deletes the source idea, adds a feature to the target idea, issues undo token. |
| Feature → Idea | Feature card menu → “convert to idea” icon | Creates a new idea with the feature’s content, removes the feature, navigates to the new idea. |

Both conversions record analytics events and reuse server actions for consistency.

---

## Styling & UX Principles

- **Interactive elements** use the `interactive-btn` helper for the subtle grow/tilt effect. Do not reinstate the old green hover state.
- **Collapsible sections** default to hidden. Motion durations stay ≤ 200 ms to respect reduced-motion settings.
- **Outline buttons** stay neutral on hover: we apply `hover:bg-primary/5` or `hover:bg-transparent` depending on context.

---

## Environment & Deployment Setup

### Required Environment Variables
- `DATABASE_URL` – Neon (local) or Vercel Postgres (cloud) connection string.
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` – Auth.js session secret + base URL.
- `EMAIL_*` – SMTP configuration for Auth.js magic links (Resend).
- `PASSWORD_EMAIL_*` – SMTP configuration for password verification emails (Google Workspace fallback).
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` – Redis REST credentials for rate limiting.
- `CRON_SECRET` – Shared secret for Vercel Cron invocations.
- `GITHUB_ID`, `GITHUB_SECRET` – Optional GitHub OAuth provider.
- `NEXT_PUBLIC_SITE_URL` – Canonical origin for the production app (used by the desktop companion).
- `NEXT_PUBLIC_DEVMODE_RELAY_URL` – Public Relay websocket URL (prefills pairing commands).
- `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE` – Release folder that serves desktop installers and CLI binaries.

Create `.env.local` from `.env.example`, populate the values above, and mirror them in Vercel for Development/Preview/Production.

### Upstash Redis
1. Create a free Redis database at [Upstash](https://upstash.com/).
2. Copy the REST URL/token into `.env.local` and Vercel (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
3. No client-side access is needed—the server actions call Upstash directly.

### Vercel Cron (Undo Purge)
1. Add `vercel.json` to schedule the purge script:
   ```json
   {
     "crons": [
       { "path": "/api/cron/purge-undo", "schedule": "0 8 * * *" }
     ]
   }
   ```
2. Generate a secret (`openssl rand -hex 32`) and set it as `CRON_SECRET` in Vercel + `.env.local`.
3. The cron handler checks `Authorization: Bearer ${CRON_SECRET}` before triggering the purge.

### Local vs. Cloud Databases
- Neon is recommended for local development; run `pnpm db:migrate` after pulling a teammate’s changes.
- Vercel Postgres handles Preview/Production deployments; migrations run in the postbuild script guarded by `VERCEL_ENV === "production"`.

### Dev Mode Relay (Terminals)
- Default: the runner companion starts a local PTY server; the browser connects via the Relay.
- Recommended: enable the managed Relay for a zero-config experience.
  - Deploy the relay in `relay/` to Fly.io (or your host). Our default deployment lives at `wss://relay-falling-butterfly-779.fly.dev`.
  - In your app env, set `NEXT_PUBLIC_DEVMODE_RELAY_ENABLED=1`, `DEVMODE_RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`, and `DEVMODE_JWT_SECRET`.
  - The desktop app auto-detects these values. CLI runners should continue exporting `RELAY_URL` + `RUNNER_TOKEN`.
- See `docs/dev-mode-relay.md` for protocol details and CLI pairing notes.

### Runner Companion Desktop App
- Location: `apps/runner-desktop/` (Electron main + preload + Vite/React renderer).
- Shared core logic lives in `packages/runner-core` and is reused by the CLI script and desktop shell.
- Development:
  ```bash
  pnpm --filter runner-desktop dev
  ```
  This runs the renderer (Vite), compiles the Electron main/preload in watch mode, and launches Electron.
- Build/Package:
  ```bash
  pnpm --filter runner-desktop package -- --publish never
  ```
  The script builds runner-core, compiles the desktop app, and invokes `electron-builder`. Artifacts land in `dist/apps/runner-desktop/`.
- Current rollout (Oct 2025): macOS DMG/ZIP are signed and notarized. Windows/Linux installers are in progress—ship the CLI runner on those platforms until the desktop build lands.
- Releases:
  - Tag the repo `runner-desktop-vX.Y.Z` (or trigger `Desktop Builds` manually) to build macOS/Windows/Linux installers via GitHub Actions.
  - Publish the generated DMG/EXE/AppImage/DEB assets (e.g., GitHub Releases) and point `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE` at that folder.
  - The downloads dashboard detects the visitor’s platform and surfaces the correct installer link; CLI binaries remain available under “Advanced”.
- Configuration:
  - Desktop settings mirror the web env. Defaults pull from `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEVMODE_RELAY_URL`, and the active Relay secret setup.
  - Pairing tokens persist via `electron-store`; the runner auto-reconnects when the app relaunches.
- macOS signing + notarization (local build):
  ```bash
  export CSC_IDENTITY_AUTO_DISCOVERY=true
  export APPLE_TEAM_ID=4QV4WR9G32                      # replace with your Team ID
  export APPLE_ID="you@example.com"                    # Apple ID that owns the Developer ID cert
  export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
  pnpm --filter runner-desktop package -- --publish never
  xcrun stapler staple dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg
  xcrun stapler validate dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg
  spctl --assess --type exec --verbose dist/apps/runner-desktop/mac-arm64/Coda\ Runner\ Companion.app
  ```
  All three commands must succeed before you ship the DMG. Gatekeeper will then open the download with no warnings.
- CLI fallback:
  - `scripts/devmode-runner.ts` now imports from `@coda/runner-core`. Keep it around for automation scripts and CI.
  - Refer to the downloads page for the latest commands and binary names.

### Relay Security & tmux Session Access

Security is a first-class feature of the relay architecture. Share these notes with anyone reviewing the system or operating the helper:

- **Pairing is the trust boundary.** Every runner must present an approved pairing token. Unless a device is paired through the helper UI (or `/api/devmode/pair/approve`), the relay rejects connections outright—even if someone guesses an idea ID or tmux session name.
- **Session names are public; credentials are not.** We intentionally stream lines such as `coda:session:coda-<idea>-primary` so the browser client can display the attach command. Knowing that name alone does not grant access; a valid runner token and the relay URL are still required.
- **Tokens are short-lived and revocable.** The helper stores runner tokens in its local keychain (`electron-store`). Removing a pairing from the helper or hitting the `/api/devmode/pair/devices/:id` DELETE endpoint revokes the token instantly and forces a fresh approval.
- **All transport is encrypted.** The relay uses `wss://` with TLS, and the local PTY server binds to `127.0.0.1`. If you expose the PTY through a tunnel (Cloudflare, etc.), enforce TLS + Access at that layer as well.
- **Operational best practices:**
  - Pair only machines you control; rotate pairings if a laptop is lost or repurposed.
  - Set strong secrets (`DEVMODE_JWT_SECRET`, relay internal secret) so runner tokens cannot be forged.
  - Enable `TTY_SYNC=tmux` so the session state lives inside tmux; detach instantly with `Ctrl+B, D` if you suspect an issue.
  - Monitor the helper’s “Runner Activity” panel or `/api/devmode/runners/online` to confirm which devices are connected.

- **Disconnect cleanly when finished.** Detach with `Ctrl+B`, `D` or run `tmux detach` to leave the session running without streaming to your browser. To terminate it completely, use `tmux kill-session -t coda-<idea>-primary`. Closing inactive sessions prevents stale attachments from lingering.

Bottom line: tmux session names are discoverable by design, but attaching to them still requires the paired runner token. Treat the pairing flow like SSH key management—keep the helper token store private and revoke pairings you no longer need.

---

## Testing Strategy

- **Unit tests** (Vitest) cover util and validation logic under `tests/unit`.
- **E2E tests** (Playwright) simulate authentication, CRUD flows, drag/drop ordering, and conversion scenarios.
- **Performance** – `pnpm lighthouse` runs against the dev server; capture results for production readiness.

Before merging:
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test -- --run`
4. *(Optional)* `pnpm playwright test`
5. *(Optional)* `pnpm lighthouse`

---

## Roadmap toward a Fully Agentic System

| Stage | Focus | Status |
| --- | --- | --- |
| **Spec Workspace** | Unified idea + feature authoring, autosave, undo, exports. | ✅
| **Agent Handoff** | Reliable JSON exports and conversion hooks. | ✅
| **Task Automation** | Generate tasks/tests directly from ideas with your preferred tooling. | 🚧
| **Closed-loop Delivery** | Agents implement tasks, run tests, and update ideas/features with results. | 🔜
| **Connector Marketplace** | Plug-and-play integrations (Jira, Linear, Notion, Figma) powered by exported JSON schema. | 🔜

We are deliberately optimising for low-cost infrastructure (Neon/Upstash/Vercel free tiers) so experimentation stays affordable while we build out agent capabilities.

---

## Contributing

1. Branch off `main`.
2. Use repository conventions and scripts documented here; external automation is optional.
3. Update tests, migrations, and documentation where relevant.
4. Run the QA commands listed above.
5. Stage relevant files and ensure tests/docs are updated.
6. Submit a PR describing the change, testing evidence, and any agent impacts.

For questions, check `AGENTS.md` or open a discussion.

---

## License

Copyright © SproutSeeds. All rights reserved.
