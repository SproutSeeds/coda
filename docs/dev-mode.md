Dev Mode (Runner + Live Logs + Preview)

Overview
- Start a dev job from your home rig and see live logs, messages, and artifacts in the app. Optionally proxy your localhost:3000 preview via Cloudflare Tunnel. New: direct Terminal passthrough over WebSocket (Option A).

Prereqs
- Postgres reachable (local Neon/Docker or Vercel Postgres) with migrations applied
- Auth working locally (`NEXTAUTH_SECRET`, email config)
- Optional: Cloudflare Tunnel + Access (for secure preview/runner callbacks)

Environment
- Add to `.env.local` (or Vercel Project Env):
  - `DEV_MODE_ISS`, `DEV_MODE_AUD` (defaults are fine for local)
  - `DEV_MODE_PRIVATE_PEM` (optional; if omitted, an HS256 dev token is used from `NEXTAUTH_SECRET`)
  - `CF_ACCESS_AUD` (optional; set if you protect runner endpoints via Cloudflare Access)
  - Optional Web Push keys (`VAPID_*`) if you enable notifications later

Database
- Apply migrations (must target the SAME DB your server uses):
  - The app resolves connection vars in this order: `DATABASE_URL`, `DATABASE_POSTGRES_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `NEON_DATABASE_URL`, `NEON_POSTGRES_URL`.
  - Ensure you export or set the correct one, then run:
    - `pnpm db:migrate`
  - If you see `relation "dev_jobs" does not exist` at runtime, your server and migration used different DBs. Fix the env var and rerun the migration, then restart the server.

Starting a Job (from the UI)
- Go to Dashboard → Ideas → open an Idea.
- Scroll to the Dev Mode card and click “Start Live Session”.
- A job is created; logs stream into the panel. Use the input to send messages to the agent.

Starting a Job (from terminal)
- Minimal curl example:
  - `ID=$(uuidgen)`
  - `curl -s -XPOST "http://localhost:3000/api/devmode/jobs" -H "Content-Type: application/json" -H "Idempotency-Key: $ID" --data '{"ideaId":"<IDEA_ID>","intent":"live-session","idempotencyKey":"'$ID'"}'`
  - Response contains `{ jobId, wsToken }` for log ingestion.
  - Send logs: `curl -s -XPOST "http://localhost:3000/api/devmode/logs/ingest?jobId=<JOB>&token=<WS_TOKEN>" -H "Content-Type: application/json" --data '{"lines":[{"level":"info","line":"hello"}]}'`

Runner (prototype)
- Poll now returns a short-lived `wsToken` that the runner uses to ingest logs for the job.
- Scripted runner:
  1) `DEV_RUNNER_ID=my-rig pnpm ts-node scripts/devmode-runner.ts`
  - If pnpm blocks native builds, approve and rebuild node-pty:
    - `pnpm approve-builds` → select `node-pty`
    - `pnpm rebuild node-pty`
  2) Create a job from the UI (Dev panel) or via curl; the runner will pick it up and stream logs.
  3) Optional: run any local CLI alongside the terminal by setting `CODEX_CMD` and `CODEX_ARGS`; output will be mirrored into Session Logs.
- Manual API testing:
  - Register: `curl -XPOST http://localhost:3000/api/devmode/runners/register -H 'Content-Type: application/json' --data '{"id":"my-rig","name":"Mac Studio","capabilities":["node20","pnpm","playwright"]}'`
  - Poll: `curl 'http://localhost:3000/api/devmode/jobs/poll?runnerId=my-rig'` → returns `{ job, wsToken }` when available
  - Ingest logs using that token and call `/finish` when done.

Recording to a remote app (Vercel)
- Set `BASE_URL` when starting the runner so ingest targets your deployed app:
  - `BASE_URL=https://<your-app>.vercel.app DEV_RUNNER_ID=my-rig pnpm ts-node --esm scripts/devmode-runner.ts`
- Terminal connections still go through your Cloudflare Tunnel (wss://dev-my-rig.codacli.com/tty), but log ingestion and job creation will hit your production app.

Preview (localhost:3000)
- Option A (simple):
  1) Install cloudflared and run: `cloudflared tunnel --url http://localhost:3000` (or a named tunnel mapping `https://dev-<runner>.codacli.com`)
  2) Protect with Cloudflare Access if public; set `CF_ACCESS_AUD` to verify requests.
  3) Paste the URL into the Dev Mode panel for a quick check, or set up the runner to report it to `/api/devmode/jobs/:id/finish` as `previewUrl` in your future enhancement.

Terminal (Option A — Direct Tunnel, pure passthrough)
- Runner starts a local PTY WebSocket server by default: `ws://127.0.0.1:8787/tty` (configure via `TTY_BIND`, `TTY_PORT`).
- Use Cloudflare Tunnel to expose it securely:
  - `cloudflared tunnel --url ws://127.0.0.1:8787 --hostname dev-<runner>.codacli.com`
  - Protect with Cloudflare Access (recommended). No shell runs in our cloud — this is a direct passthrough to your rig.
- In the app, open Idea → Dev Mode and scroll to Terminal. Enter the tunnel URL (for local dev: `ws://localhost:8787/tty`; in cloud: `wss://dev-<runner>.codacli.com/tty`) and click Connect.
- Resize is supported via the terminal’s fit addon; the panel attempts to auto-fit on resize.
  - If Cloudflare Access prompts are enabled, open the tunnel hostname in a new tab once to satisfy Access; the WebSocket will connect after the Access cookie is present.

Synced Terminals (tmux)
- Enable tmux-backed sessions so your local terminal and the web terminal share the exact same state.
  - Start the runner with: `TTY_SYNC=tmux DEV_RUNNER_ID=my-rig pnpm ts-node --esm scripts/devmode-runner.ts`
  - Each new web terminal spawns/attaches to a tmux session (e.g., `coda-abc123`). The runner logs the session name.
  - Attach from your local terminal: `tmux attach -t coda-abc123`.
  - Now both your local terminal and the web terminal see identical screens and keystrokes.
  - Recording still works as before; PTY output is mirrored to logs.
- Optional cwd override for sessions: set `TTY_CWD=/path/to/project`.

Per-Idea Project Root (UI)
- In the Idea → Dev Mode → Terminals panel, set the “Project Root” path. New terminal connections will request this as the working directory.
- The terminal client appends `?cwd=...` to the WebSocket URL; the runner uses that `cwd` to spawn/attach the shell (or tmux session) in that directory.
- This path must exist on the runner machine. For Windows, use `C:\\path\\to\\project`.

Agent Session ID (UI)
- In the Terminals panel, you can set an optional “Codex Session ID” to help external tooling resume a session. On connect, the client auto-exports `CODEX_SESSION="<id>"` into the shell (bash/zsh).
- On Windows PowerShell, set `$env:CODEX_SESSION='<id>'` manually if needed.

Pick Folder (Native Dialog via Runner)
- Click “Pick Folder…” next to the Project Root input. The runner opens a native folder picker on your machine (macOS uses AppleScript, Windows uses PowerShell, Linux tries `zenity`).
- After you pick, the Project Root is updated and copied to your clipboard.
- Requirements:
  - macOS: built-in AppleScript works out of the box.
  - Windows: PowerShell COM folder dialog is used by default.
  - Linux: install `zenity` for a GUI dialog (`sudo apt install zenity`). If not installed, the picker will be unavailable.

Notes on Security
- Terminal access is gated by your Cloudflare Access policy when using a public hostname. We do not proxy or relay shell bytes through our server in Option A.
- Do not expose `ws://` publicly; use `wss://` behind Access for remote usage.

Session Logs (Persist Terminal Output)
- The Terminal now records by default: when you connect, the app creates a Dev Mode job (`intent: terminal-record`) and the runner mirrors PTY output to the job’s logs.
- Live viewers can watch via the app; logs are persisted in Postgres (`dev_logs`) until you delete them.
- API to fetch history: `GET /api/devmode/jobs/:id/logs?afterSeq=&limit=`
- To stop recording, disconnect the terminal; the runner finalizes the job automatically.
- Privacy: only output is recorded by default (not raw keystrokes). We’ll add optional “submitted commands” with redaction later.

Notes
- This implementation uses an in-memory event bus for SSE. In serverless/multi-region, move to a durable pub/sub (Redis Stream / Upstash QStash) for fan-out.
- WS ingress can be swapped in later for direct bi-di streaming; today we authenticate log ingestion via a short-lived token and use SSE to the browser.
- Do not expose any secrets to the client; only short-lived tokens are sent in responses.
