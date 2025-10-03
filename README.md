# coda-cli
**Lightning-fast CLI for orchestrating and running containerized AI agents and workflows.**  
Minimal, portable, and built to work anywhere — laptop, GPU rig, or cloud.

---

## Overview

`coda-cli` is a clean command-line tool to register, launch, and monitor **Dockerized agents**.  
Configs live in YAML, runs are reproducible, and logs are readable. It’s the backbone of a “develop-on-the-go” workflow: take your `.coda.yaml` with you and spin up agents on any machine with Docker.

---

## Features

- **Declarative agents** via `.coda.yaml`
- **Lifecycle controls**: list, run, status, logs
- **Rich terminal output** (colors/structure)
- **Zero ceremony** install paths (PyPI/GitHub)
- **Companion Web UI ready** (see below)

---

## Tech Stack

### CLI (this repo)
- **Python 3.11+**
- **Typer** (CLI framework)
- **docker-py** (Docker SDK)
- **PyYAML**, **Rich**
- **Poetry** (packaging)
- **pytest** (tests)

### ✅ Companion Web UI (definitive choice)
- **Next.js 15 (TypeScript) + Tailwind + shadcn/ui** for a fast, modern UI
- **Real-time logs** via **WebSocket** to the API
- **PWA** mode for offline viewing of recent tasks/configs
- **FastAPI** backend (Python) that wraps the same orchestrator used by the CLI  
  > One source of truth: the API imports the same Python orchestrator module the CLI calls.

**Core API surface (shared by CLI & Web):**
- `GET /agents` — list agents
- `POST /agents/{name}/run` — start agent → `{ task_id }`
- `GET /tasks/{id}` — status
- `GET /tasks/{id}/logs` — historical logs (paged)
- `WS /tasks/{id}/stream` — live logs & status

---

## Prerequisites

- **Docker** (local or remote daemon)
- **Python 3.11+**

---

## Installation

### PyPI (when published)
```bash
pip install coda-cli
```

### One-liner from GitHub (Bash)
```bash
pip install git+https://github.com/SproutSeeds/coda-cli.git
```

### One-liner from GitHub (Windows PowerShell)
```powershell
py -m pip install git+https://github.com/SproutSeeds/coda-cli.git
```

### From source (dev)
```bash
git clone https://github.com/SproutSeeds/coda-cli.git
cd coda-cli
poetry install
```
_or without Poetry_
```bash
pip install -e .
```

---

## Quickstart

1) **Define your agents**  
Create `.coda.yaml`:
```yaml
agents:
  - name: echo-agent
    image: busybox
    command: echo Hello, Coda
```

2) **List agents**
```bash
coda agent list
```

3) **Run an agent**
```bash
coda agent run --name echo-agent
```

4) **Inspect**
```bash
coda agent status
coda agent logs --id <task-id>
```

---

## Develop-on-the-Go (why this works anywhere)

- **Portable config**: everything lives in `.coda.yaml` — version it in Git and reproduce runs on any box with Docker.
- **Low friction**: Python + Docker only. Fresh laptop? One install command and you’re moving.
- **Future Web UI**: PWA keeps recent task history offline; WebSocket streams logs live when online.
- **Context switching**: point CLI/API at local Docker or a remote GPU host (Tailscale/Cloudflare Tunnel recommended).

---

## Directory Structure (current)
```
coda-cli/
  cli.py
  .coda.yaml
  README.md
  examples/
  tests/
  coda/            # internal modules (as project grows)
```

> If you add the Web UI and API, consider a monorepo:
```
/coda
  /apps
    /web           # Next.js (TS) + Tailwind + shadcn/ui (PWA)
    /cli           # Typer CLI (this repo)
  /services
    /api           # FastAPI; imports orchestrator
  /libs
    /orchestrator  # Python core used by CLI & API
    /schemas       # OpenAPI/JSON Schema & generated clients
```

---

## Testing

```bash
pytest
# or
poetry run pytest
```

---

## Contributing

PRs and issues welcome.  
- Write tests for new features
- Keep commands minimal and well-documented
- Prefer small, composable modules

---

## License

MIT

---

## Status

`v0.0` — rock-solid core, expanding toward workflows, remote orchestration, and the companion Web UI.
