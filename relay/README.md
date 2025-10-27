Relay WebSocket Service (Fly.io)

Overview

- Purpose: A lightweight WebSocket relay that brokers interactive PTY sessions between a browser client (your app’s UI) and a runner (user’s machine).
- Endpoints:
  - `/runner` — Runner connects with a long‑lived `runnerToken` (JWT).
  - `/client` — Browser connects with a short‑lived `sessionToken` (JWT).
- Protocol: JSON frames. The relay forwards PTY control and data between client and runner keyed by `sessionId`.

Quick Start (local)

1) Install deps:
   - `cd relay && pnpm install`
2) Run:
   - `pnpm dev`
   - Server listens on `:8080` by default (`PORT` env to override).

Deploy to Fly.io

1) Create the Fly app:
   - `fly launch` (answer prompts; app name will be used as `<your-fly-app>.fly.dev`)
2) Secrets (same values used by Vercel app):
   - `fly secrets set DEVMODE_JWT_SECRET=...`
3) Deploy:
   - `fly deploy`
4) DNS:
   - Point your clients at `wss://relay-falling-butterfly-779.fly.dev` (or your own host/CNAME).

Environment

- `DEVMODE_JWT_SECRET` — HMAC secret to verify both client and runner tokens.
- `PORT` — HTTP port (default `8080`).
- `APP_BASE_URL` — Base URL of your app (e.g., `https://your-app.vercel.app`) used to validate runner tokens.
- `RELAY_INTERNAL_SECRET` — Shared secret sent as `X-Relay-Secret` to the app’s verify endpoint.

Token Claims (HS256)

- Runner token (`type: "runner"`): `{ runnerId, userId }` long‑lived; used by `/runner`.
- Client session token (`type: "client"`): `{ sessionId, userId, ideaId, runnerId? }` ~10 min TTL; used by `/client`.

Message Types

- Client → Relay → Runner
  - `{ type: "stdin", sessionId, data }`
  - `{ type: "resize", sessionId, cols, rows }`
  - `{ type: "record", sessionId, jobId, token }`
  - `{ type: "pick-cwd", sessionId }`

- Runner → Relay → Client
  - `{ type: "stdout", sessionId, data }` (PTY data)
  - `{ type: "meta", sessionId, data }` (out‑of‑band lines like `coda:session:...` or `coda:cwd:...`)

Notes

- The relay is stateless across restarts; it holds only in‑memory connection maps.
- Authentication is enforced by verifying JWTs with `DEVMODE_JWT_SECRET`.
- If `APP_BASE_URL` and `RELAY_INTERNAL_SECRET` are set, the relay calls
  `GET /api/devmode/tokens/runner/verify?jti=…` on the app before accepting a `/runner` connection.
