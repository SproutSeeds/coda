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

_Last updated: 2025-10-26_
