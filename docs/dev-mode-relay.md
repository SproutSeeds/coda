Dev Mode — Relay Architecture (Fly.io)

What this adds

- A small WebSocket relay that brokers PTY sessions between:
  - Browser Client (your Vercel app) and
  - Runner (user machine where PTY is spawned).
- DNS: `wss://relay-falling-butterfly-779.fly.dev` (or your own host) as the stable entry.
- App API: `/api/devmode/sessions` mints short‑lived session tokens for clients.
- Runner: connects out to the relay with a long‑lived runner token.

Envs (App)

- `NEXT_PUBLIC_DEVMODE_RELAY_ENABLED=1` (to prefer relay from the UI)
- `DEVMODE_RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`
- `DEVMODE_JWT_SECRET=<shared>` (HS256; also set on the relay service)
- `RELAY_INTERNAL_SECRET=<shared>` (relay calls the app’s verify endpoint with this header)

Envs (Runner)

- `RELAY_URL=wss://relay-falling-butterfly-779.fly.dev`
- `RUNNER_TOKEN=<jwt for this runner>`
- Optional: `TTY_CWD`, `TTY_SYNC=tmux` etc. still work.

Pairing flow (no tokens for users)

- Start (Runner): runner calls `POST /api/devmode/pair/start` and displays a short code like `F9G-7QK`.
- Approve (User): visit the app → Enable Dev Mode → enter the code (calls `POST /api/devmode/pair/approve`).
- Poll (Runner): runner polls `GET /api/devmode/pair/check?code=…` until approved, then receives `{ relayUrl, runnerId, runnerToken }` and stores it locally.
- Reconnect: on next launch, runner reuses the stored token; no user action required.

Endpoints

- `POST /api/devmode/pair/start` → `{ code, expiresAt }`
- `POST /api/devmode/pair/approve` (auth required) body `{ code, runnerId? }` → `{ ok: true, runnerId }`
- `GET /api/devmode/pair/check?code=…` → `{ status: 'pending'|'approved'|'expired'|'consumed', ... }`

Runner token

- Mint with the helper in `lib/devmode/session.ts` (or a one‑off admin script):
  - payload `{ type: "runner", runnerId, userId }` signed with `DEVMODE_JWT_SECRET`.
  - TTL: long‑lived (e.g., 30 days) by default.

Client (browser) flow

1) UI calls `POST /api/devmode/sessions` with `{ ideaId }`.
2) Server returns `{ relayUrl, sessionId, token }`.
3) UI opens `wss://relay-falling-butterfly-779.fly.dev/client?token=...` and starts sending input/resize.
4) The relay pairs the client with an online runner for the same `userId` (or the specified `runnerId`).

Message protocol

- Client → Runner: `{ type: "stdin"|"resize"|"record"|"pick-cwd", sessionId, ... }`
- Runner → Client: `{ type: "stdout"|"meta", sessionId, data }`  
  - `meta` is for out‑of‑band lines like `coda:session:…` or `coda:cwd:…`.

Deploy relay

1) `cd relay && fly launch` and set secrets: `fly secrets set DEVMODE_JWT_SECRET=…`
2) `fly deploy`
3) (Optional) Create a CNAME (e.g., `relay.codacli.com` → `<app>.fly.dev`) if you want a branded hostname.
4) In Vercel Project → Environment Variables: set `DEVMODE_RELAY_URL` and `DEVMODE_JWT_SECRET`; in your local `.env.local`, set `NEXT_PUBLIC_DEVMODE_RELAY_ENABLED=1`.

Revocation & security notes

- Existing “manual URL” flow remains as a fallback; the UI automatically prefers relay when enabled.
- Logs ingest remains in your Vercel app; the runner mirrors PTY output to `/api/devmode/logs/ingest` when recording is enabled.
- Pairing records are short‑lived (10 minutes). Runners store the token at `~/Library/Application Support/Coda Runner/config.json` (macOS), `%APPDATA%/Coda Runner/config.json` (Windows), or `~/.config/coda-runner/config.json` (Linux).
- Runner tokens carry a `jti` (pairing id). The relay calls `GET /api/devmode/tokens/runner/verify?jti=…` on the app with `X-Relay-Secret: ${RELAY_INTERNAL_SECRET}` before accepting a runner; revoked tokens are rejected.
