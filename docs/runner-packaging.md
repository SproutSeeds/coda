Runner Packaging (Binaries)

Overview

- Build a standalone runner binary for macOS, Windows, and Linux using `pkg`.
- The build compiles `scripts/devmode-runner.ts` to JS (CommonJS) and then packages it.

Prereqs

- `pnpm install` (installs `pkg` dev dependency)
- Node 20.x locally (targets are Node 20)

Build commands

- macOS (Apple Silicon): `pnpm runner:pkg:mac-arm64`
- macOS (Intel): `pnpm runner:pkg:mac-x64`
- Windows (x64): `pnpm runner:pkg:win-x64`
- Linux (x64): `pnpm runner:pkg:linux-x64`

Outputs

- `dist/coda-runner-macos-arm64`
- `dist/coda-runner-macos-x64`
- `dist/coda-runner-win-x64.exe`
- `dist/coda-runner-linux-x64`

Usage

On first launch, the runner will show a pairing code if no token is stored:

```
./coda-runner-macos-arm64
==== Coda Runner Pairing ====
Code: F9G-7QK
Open your Coda app → Enable Dev Mode → Enter this code to approve.
```

Environment

- `BASE_URL` (required): the app environment (e.g., `https://your-app.vercel.app` or `http://localhost:3000`).
- `RELAY_URL` (recommended): your relay WSS endpoint (e.g., `wss://relay-falling-butterfly-779.fly.dev`).
- `DEV_RUNNER_ID` (optional): label for this device (defaults to a generated value during approval if omitted).

Examples

```
RELAY_URL=wss://relay-falling-butterfly-779.fly.dev \
BASE_URL=https://your-app.vercel.app \
DEV_RUNNER_ID=my-laptop \
./dist/coda-runner-macos-arm64
```

Notes

- Tokens are stored in:
  - macOS: `~/Library/Application Support/Coda Runner/config.json`
  - Windows: `%APPDATA%/Coda Runner/config.json`
  - Linux: `~/.config/coda-runner/config.json`
- Revoking tokens centrally requires server-side checks; current relay validates JWT signatures only. A future update will introduce token IDs with allow/deny checks.
