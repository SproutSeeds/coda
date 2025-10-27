# TMUX-First Runner Roadmap

## Context & Objectives
- Replace the current helper-app focus on launching standalone terminals with a single purpose: bridge the web experience to a developer’s existing TMUX environment.
- Guarantee copyable, accurate attach instructions (initial command: `tmux attach -t coda`) and persistent relay connectivity after pairing.
- Support multiple “idea” workspaces, where each idea can expose one or more saved TMUX sessions that reconnect to the exact state a user last saw inside the web app.
- Keep server-side knowledge (UI + APIs) in sync with the local TMUX state so users reopen a tab and immediately regain command history without reinitialising the terminal.

## High-Level Architecture
1. **Session Naming Scheme**
   - Canonical identifier: `coda::<ideaId>::<slot>` where slot defaults to `primary`.
   - Desktop helper exposes a copyable attach command that substitutes the active idea + slot.
   - Relay metadata records the active session, enabling the web UI to show status instantly.
2. **Persistence Layer**
   - Extend project DB (`ideas_terminal_sessions` table) to track session metadata: idea id, slot, last connected at, last detach at, transcript cursor.
   - Store compressed command history snapshots (e.g. JSON blob) per session to prime future reconnections.
3. **Sync Protocol**
   - When the browser requests a session, helper streams delta output; the web app merges with saved transcript using `last_sequence` markers.
   - On detach, helper pushes final sequence id + flushes buffer into persistence.
4. **Desktop Helper Simplification**
   - Strip non-TMUX flows: remove local terminal launch buttons, fallback runner modes, legacy CLI instructions.
   - UI states: pairing, attach instructions, active session dashboard (idea/session list, copy command, status badges).
5. **Server & API Changes**
   - `POST /api/devmode/sessions` to reserve a TMUX slot for an idea.
   - `PATCH /api/devmode/sessions/{id}` to update status, persist transcripts.
   - WebSocket channel (or reuse existing relay) to notify browser when a session goes live / offline.

## Task Breakdown
1. **Design & Docs**
   - Finalise TMUX session schema and naming rules.
   - Document attach workflows for macOS/Linux (include Windows WSL guidance).
2. **Database & API Layer**
   - Add migration for `ideas_terminal_sessions`.
   - Implement CRUD endpoints & server actions driven by authenticated users.
3. **Desktop Helper Refactor**
   - Remove legacy UI + flows; introduce TMUX-only screens.
   - Ensure pairing flow surfaces the correct attach command + session selector.
   - Bundle `ws` and other essentials; trim unneeded deps.
4. **Relay / runner-core Updates**
   - Confirm relay only attempts TMUX operations (no fallback exec).
   - Add metadata heartbeats so browser can show per-session availability.
5. **Web App UX**
   - Idea detail view: list saved sessions, connect button, transcript preview.
   - Provide “Attach instructions” modal that mirrors the helper output.
6. **Persistence & Transcript Sync**
   - Implement transcript snapshotting & delta merge logic.
   - Add background job to prune stale history beyond retention window.
7. **Testing & Telemetry**
   - Unit + integration tests around session lifecycle.
   - Manual QA script: install helper → pair → attach → detach → reopen idea.
   - Instrument metrics (session attach latency, transcript size).
8. **Rollout & Documentation**
   - Update README / docs with TMUX-first install steps.
   - Provide migration guidance for existing users (legacy helper → TMUX attach).

## Execution Protocol
1. **Workstream Prioritisation**
   - Tackle tasks sequentially: schema/API groundwork → helper refactor → web UI → transcript persistence → telemetry.
   - Maintain a working build after each major step (no broken helper or UI between commits).
2. **Branching & Reviews**
   - Feature branch per major workstream (e.g. `tmux/helper-refactor`).
   - Submit PRs with paired test evidence (screenshots, logs) before merge.
3. **Validation Checklist**
   - `pnpm runner:package-local` produces a DMG with tmux-only UI.
   - Installing the helper, pairing, running `tmux attach -t coda::<ideaId>::primary` succeeds.
   - Web app loads saved transcript and resumes from last command.
4. **Documentation & Knowledge Transfer**
   - Keep this plan updated as tasks complete; log deviations in AGENTS.md.
   - Draft end-user guide (docs/runner-tmux.md) once functionality stabilises.

## Release & Deployment Runbook
1. **Local validation**
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test -- --run`
   - Optional: `pnpm playwright test`
   - Optional: `pnpm lighthouse`
2. **Runner builds & helper packaging**
   - `pnpm --filter @coda/runner-core build`
   - `pnpm --filter @coda/runner-desktop install`
   - `pnpm --filter @coda/runner-desktop build`
   - `pnpm runner:package-local`
     - Outputs `apps/dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg`
     - Copies the DMG into `public/runner/`
3. **Publish the helper**
   - Upload `public/runner/coda-runner-companion-mac-arm64.dmg` to the GitHub Release (or chosen distribution channel).
4. **Stage & commit**
   - `git status`
   - `git add <changed files>`
   - `git commit -m "..."` (descriptive message)
   - `git push origin <branch>`
5. **Preview database migration**
   - `DATABASE_URL="postgresql://…neon…sslmode=require" pnpm db:migrate`
6. **Verify preview**
   - Wait for the Vercel preview deployment to succeed and smoke-test it.
7. **Configure production environment (Vercel)**
   - Ensure the following env vars are present:
     - `TTY_SYNC=tmux`
     - `TTY_SESSION_PREFIX=coda` (optional override)
     - `NEXT_PUBLIC_DEVMODE_RELAY_ENABLED=1`
     - `NEXT_PUBLIC_DEVMODE_RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`
     - `DEVMODE_RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`
     - `NEXT_PUBLIC_SITE_URL=https://<prod-domain>`
     - `NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE=https://github.com/<org>/<repo>/releases/download/<tag>`
8. **Production migration**
   - `DATABASE_URL="postgresql://…prod…" pnpm db:migrate` (run immediately before or during the prod deploy).
9. **Runner service configuration (Fly.io)**
   - `fly secrets set -a relay-falling-butterfly-779 TTY_SYNC=tmux TTY_SESSION_PREFIX=coda`
   - `fly secrets set -a relay-falling-butterfly-779 DEVMODE_RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`
   - `fly secrets set -a relay-falling-butterfly-779 NEXT_PUBLIC_DEVMODE_RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`
   - `fly secrets set -a relay-falling-butterfly-779 NEXT_PUBLIC_SITE_URL=https://<prod-domain>`
   - `fly secrets set -a relay-falling-butterfly-779 RELAY_INTERNAL_SECRET=<shared-secret>`
   - `fly apps restart relay-falling-butterfly-779`
10. **Relay redeploy** (only if `relay/` code changed)
    - `cd relay`
    - `fly status -a relay-falling-butterfly-779` (optional)
    - `fly deploy -a relay-falling-butterfly-779 --remote-only`
    - `fly logs -a relay-falling-butterfly-779` (confirm healthy startup)
11. **Production verification**
    - In prod Dev Mode → Terminals: confirm the streamed `coda:session:…` line appears.
    - Locally attach with `tmux attach -t <name>`; verify mirrored output.
    - Check helper logs for “TTY server listening” and absence of node-pty warnings.
12. **Documentation updates**
    - Refresh README and `AGENTS.md` with the new download link, tmux guidance, helper workflow, and any relay deployment notes.

_Last updated: 2025-10-26_
