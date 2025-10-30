# DevMode & Runner Technical Specification

## Executive Summary

This document provides comprehensive technical documentation for Coda's DevMode system, which bridges web-based planning with local development execution. It covers the runner architecture (Electron desktop app and CLI), terminal synchronization via tmux, WebSocket relay protocol, job orchestration, and log persistence.

## System Overview

DevMode enables users to orchestrate local development tasks from the web interface while maintaining real-time visibility into command execution, logs, and terminal sessions.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Application (Next.js)                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Dashboard UI                                           │    │
│  │  - TerminalDock (xterm.js)                             │    │
│  │  - Job Management                                       │    │
│  │  - Runner Activity Feed                                 │    │
│  │  - Pairing Management                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  API Routes                                             │    │
│  │  - /api/devmode/pair/request     (POST)                │    │
│  │  - /api/devmode/pair/approve     (POST)                │    │
│  │  - /api/devmode/jobs             (POST, GET)           │    │
│  │  - /api/devmode/jobs/:id/logs    (GET)                 │    │
│  │  - /api/devmode/logs/ingest      (POST)                │    │
│  │  - /api/devmode/logs/by-idea/:id (GET)                 │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                    │                    ▲
                    │ REST/JWT           │ REST/JWT
                    ▼                    │
┌─────────────────────────────────────────────────────────────────┐
│                  WebSocket Relay Server (Fly.io)                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  relay/index.ts                                         │    │
│  │  - Connection management                                │    │
│  │  - Message routing                                      │    │
│  │  - Session pairing                                      │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         ▲                                          ▲
         │ WebSocket                    WebSocket   │
         │ (Browser Terminal)           (Runner)    │
         │                                           │
┌────────┴────────┐                    ┌────────────┴────────────┐
│  Browser xterm  │                    │  Desktop Runner         │
│  - Input/Output │                    │  (Electron App)         │
│  - Resize       │                    │                         │
└─────────────────┘                    │  ┌──────────────────┐  │
                                        │  │ runner-core      │  │
                                        │  │ - node-pty       │  │
                                        │  │ - tmux wrapper   │  │
                                        │  │ - Job polling    │  │
                                        │  │ - Log batching   │  │
                                        │  └──────────────────┘  │
                                        │           │            │
                                        │           ▼            │
                                        │  ┌──────────────────┐  │
                                        │  │  tmux sessions   │  │
                                        │  │  - Per-idea      │  │
                                        │  │  - Persistent    │  │
                                        │  └──────────────────┘  │
                                        └─────────────────────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────────────┐
                                        │  Local Development Env  │
                                        │  - Git repos            │
                                        │  - Build tools          │
                                        │  - Test runners         │
                                        └─────────────────────────┘
```

## Runner Implementations

### 1. Desktop Runner (Electron)

**Location:** `apps/runner-desktop/`

**Purpose:** User-friendly GUI for non-terminal users to manage runner connections, view logs, and control job execution.

**Key Technologies:**
- Electron 28+ (main, renderer, preload processes)
- Vite (for renderer build)
- React (renderer UI)
- `@coda/runner-core` (shared logic)

**Project Structure:**
```
apps/runner-desktop/
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron main process
│   │   └── ipc-handlers.ts       # IPC communication
│   ├── preload/
│   │   └── index.ts              # Preload script (bridge)
│   └── renderer/
│       ├── App.tsx               # Main UI component
│       ├── components/
│       │   ├── ConnectionStatus.tsx
│       │   ├── JobList.tsx
│       │   └── Settings.tsx
│       └── main.tsx              # Renderer entry point
├── build/
│   └── coda-icon.icns           # App icon (macOS)
├── scripts/
│   └── afterPack-ensure-icon.js # Post-build icon verification
├── electron-builder.yml         # Build configuration
└── package.json
```

**IPC Communication:**

```typescript
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';
import { startRunner, stopRunner } from '@coda/runner-core';

ipcMain.handle('runner:start', async (event, config) => {
  const { relayUrl, token, tmuxEnabled } = config;
  await startRunner({ relayUrl, token, tmuxEnabled });
  return { success: true };
});

ipcMain.handle('runner:stop', async () => {
  await stopRunner();
  return { success: true };
});

ipcMain.handle('runner:status', async () => {
  return await getRunnerStatus();
});
```

```typescript
// src/preload/index.ts (Preload Script)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startRunner: (config) => ipcRenderer.invoke('runner:start', config),
  stopRunner: () => ipcRenderer.invoke('runner:stop'),
  getStatus: () => ipcRenderer.invoke('runner:status'),
  onLogMessage: (callback) => ipcRenderer.on('log:message', callback),
});
```

```typescript
// src/renderer/App.tsx (Renderer)
function App() {
  const [status, setStatus] = useState<RunnerStatus>();

  useEffect(() => {
    window.electronAPI.getStatus().then(setStatus);

    const unsubscribe = window.electronAPI.onLogMessage((event, message) => {
      console.log('Log:', message);
    });

    return unsubscribe;
  }, []);

  const handleStart = async () => {
    await window.electronAPI.startRunner({
      relayUrl: 'wss://relay.example.com',
      token: 'jwt-token',
      tmuxEnabled: true,
    });
  };

  return (
    <div>
      <ConnectionStatus status={status} />
      <button onClick={handleStart}>Start Runner</button>
    </div>
  );
}
```

**Build Process:**

```bash
# Development (hot reload)
pnpm --filter @coda/runner-desktop dev

# Production build
cd apps/runner-desktop
pnpm run package

# Output locations:
# macOS: dist/apps/runner-desktop/mac-arm64/Coda Runner Companion.app
# Windows: dist/apps/runner-desktop/win-unpacked/Coda Runner Companion.exe
# Linux: dist/apps/runner-desktop/linux-unpacked/coda-runner-companion
```

**Icon Generation (Critical Fix):**

**Problem:** The `png2icons` npm library generated incomplete ICNS files (5.3KB) that displayed incorrectly in Finder.

**Solution:** `scripts/generate-runner-icons.mjs` uses macOS native `iconutil`:

```javascript
// scripts/generate-runner-icons.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sizes = [16, 32, 64, 128, 256, 512];
const iconsetPath = 'apps/runner-desktop/build/coda-icon.iconset';

// Create iconset directory
fs.mkdirSync(iconsetPath, { recursive: true });

// Generate all required PNG sizes
for (const size of sizes) {
  await sharp('apps/runner-desktop/assets/coda-icon.svg')
    .resize(size, size)
    .png()
    .toFile(path.join(iconsetPath, `icon_${size}x${size}.png`));

  // Retina variants
  await sharp('apps/runner-desktop/assets/coda-icon.svg')
    .resize(size * 2, size * 2)
    .png()
    .toFile(path.join(iconsetPath, `icon_${size}x${size}@2x.png`));
}

// Use macOS iconutil to create proper ICNS
execSync(`iconutil -c icns ${iconsetPath} -o apps/runner-desktop/build/coda-icon.icns`);

// Clean up iconset
fs.rmSync(iconsetPath, { recursive: true });

console.log('✓ Generated proper ICNS file (should be ~221KB)');
```

**Signing & Notarization (macOS):**

```bash
# Environment variables required
export CSC_IDENTITY_AUTO_DISCOVERY=true
export APPLE_TEAM_ID="4QV4WR9G32"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"

# Build and sign
cd apps/runner-desktop
pnpm run package -- --publish never

# Verify notarization
xcrun stapler staple ../../dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg
xcrun stapler validate ../../dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg

# Check Gatekeeper
spctl --assess --type exec --verbose "../../dist/apps/runner-desktop/mac-arm64/Coda Runner Companion.app"
```

**Electron Builder Configuration:**

```yaml
# apps/runner-desktop/electron-builder.yml
appId: com.coda.runner-companion
productName: Coda Runner Companion
directories:
  output: ../../dist/apps/runner-desktop
  buildResources: build

mac:
  icon: build/coda-icon.icns
  category: public.app-category.developer-tools
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  target:
    - target: dmg
      arch: [arm64, x64]

win:
  icon: build/coda-icon.ico
  target:
    - target: nsis
      arch: [x64]

linux:
  icon: build/coda-icon.png
  category: Development
  target:
    - target: AppImage
    - target: deb

afterPack: scripts/afterPack-ensure-icon.js
```

### 2. CLI Runner (Legacy/Advanced Users)

**Location:** `scripts/devmode-runner.ts`

**Purpose:** Lightweight command-line runner for CI environments or advanced users who prefer terminal-based tools.

**Usage:**

```bash
# Build
pnpm runner:build

# Run with environment variables
export RELAY_URL="wss://relay.example.com"
export RUNNER_TOKEN="jwt-token"
export TTY_SYNC="tmux"
node dist/runner/devmode-runner.js

# Package as standalone binary
pnpm runner:pkg:mac-arm64
./dist/binaries/coda-runner-macos-arm64
```

**Implementation:**

```typescript
// scripts/devmode-runner.ts
import { startRunner } from '@coda/runner-core';

const config = {
  relayUrl: process.env.RELAY_URL || 'ws://localhost:8080',
  token: process.env.RUNNER_TOKEN,
  tmuxEnabled: process.env.TTY_SYNC === 'tmux',
  jobPollInterval: parseInt(process.env.POLL_INTERVAL || '10000'),
};

async function main() {
  console.log('Starting Coda DevMode Runner...');
  console.log('Relay URL:', config.relayUrl);
  console.log('tmux enabled:', config.tmuxEnabled);

  await startRunner(config);

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await stopRunner();
    process.exit(0);
  });
}

main().catch(console.error);
```

## Runner Core (`@coda/runner-core`)

**Location:** `packages/runner-core/`

**Purpose:** Shared business logic for both desktop and CLI runners. Handles job polling, PTY management, tmux sessions, and log ingestion.

**Key Modules:**

### 1. Job Polling

```typescript
// packages/runner-core/src/job-poller.ts
export class JobPoller {
  private interval: NodeJS.Timer | null = null;

  constructor(
    private apiUrl: string,
    private token: string,
    private pollInterval: number
  ) {}

  start(onJob: (job: Job) => Promise<void>) {
    this.interval = setInterval(async () => {
      try {
        const jobs = await this.fetchPendingJobs();
        for (const job of jobs) {
          await onJob(job);
        }
      } catch (error) {
        console.error('Job polling error:', error);
      }
    }, this.pollInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async fetchPendingJobs(): Promise<Job[]> {
    const response = await fetch(`${this.apiUrl}/api/devmode/jobs`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### 2. PTY Manager

```typescript
// packages/runner-core/src/pty-manager.ts
import * as pty from 'node-pty';

export class PTYManager {
  private processes = new Map<string, pty.IPty>();

  spawn(id: string, command: string, cwd: string): pty.IPty {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = pty.spawn(shell, ['-c', command], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        // Ensure Homebrew paths are available (macOS fix)
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
      },
    });

    this.processes.set(id, ptyProcess);
    return ptyProcess;
  }

  get(id: string): pty.IPty | undefined {
    return this.processes.get(id);
  }

  kill(id: string): void {
    const process = this.processes.get(id);
    if (process) {
      process.kill();
      this.processes.delete(id);
    }
  }

  killAll(): void {
    for (const [id, process] of this.processes) {
      process.kill();
    }
    this.processes.clear();
  }
}
```

### 3. tmux Session Manager

```typescript
// packages/runner-core/src/tmux-manager.ts
import { execSync } from 'child_process';

export class TmuxManager {
  hasSession(sessionName: string): boolean {
    try {
      execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  createSession(sessionName: string, cwd: string): void {
    if (!this.hasSession(sessionName)) {
      execSync(`tmux new-session -d -s ${sessionName} -c ${cwd}`);
    }
  }

  attachSession(sessionName: string): string {
    // Returns session ID for reconnection
    return execSync(`tmux display-message -p -t ${sessionName} '#{session_id}'`)
      .toString()
      .trim();
  }

  sendKeys(sessionName: string, keys: string): void {
    execSync(`tmux send-keys -t ${sessionName} ${JSON.stringify(keys)}`);
  }

  capturePane(sessionName: string): string {
    return execSync(`tmux capture-pane -t ${sessionName} -p`)
      .toString();
  }

  killSession(sessionName: string): void {
    if (this.hasSession(sessionName)) {
      execSync(`tmux kill-session -t ${sessionName}`);
    }
  }
}
```

### 4. Log Batcher

```typescript
// packages/runner-core/src/log-batcher.ts
export class LogBatcher {
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timer | null = null;

  constructor(
    private apiUrl: string,
    private token: string,
    private batchSize: number = 50,
    private flushInterval: number = 5000
  ) {}

  add(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      await fetch(`${this.apiUrl}/api/devmode/logs/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ logs: batch }),
      });
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Re-add failed logs to buffer (with limit to prevent unbounded growth)
      this.buffer.unshift(...batch.slice(0, 100));
    }
  }
}
```

### 5. Runner Orchestrator

```typescript
// packages/runner-core/src/index.ts
import { JobPoller } from './job-poller';
import { PTYManager } from './pty-manager';
import { TmuxManager } from './tmux-manager';
import { LogBatcher } from './log-batcher';
import WebSocket from 'ws';

export interface RunnerConfig {
  relayUrl: string;
  token: string;
  tmuxEnabled: boolean;
  jobPollInterval?: number;
  logBatchSize?: number;
  logFlushInterval?: number;
}

let poller: JobPoller | null = null;
let ptyManager: PTYManager | null = null;
let tmuxManager: TmuxManager | null = null;
let logBatcher: LogBatcher | null = null;
let relayConnection: WebSocket | null = null;

export async function startRunner(config: RunnerConfig): Promise<void> {
  const {
    relayUrl,
    token,
    tmuxEnabled,
    jobPollInterval = 10000,
    logBatchSize = 50,
    logFlushInterval = 5000,
  } = config;

  // Initialize managers
  ptyManager = new PTYManager();
  tmuxManager = tmuxEnabled ? new TmuxManager() : null;
  logBatcher = new LogBatcher(
    relayUrl.replace('wss://', 'https://').replace('ws://', 'http://'),
    token,
    logBatchSize,
    logFlushInterval
  );

  // Connect to relay
  relayConnection = new WebSocket(relayUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  relayConnection.on('open', () => {
    console.log('Connected to relay');
  });

  relayConnection.on('message', (data) => {
    handleRelayMessage(JSON.parse(data.toString()));
  });

  relayConnection.on('error', (error) => {
    console.error('Relay connection error:', error);
  });

  relayConnection.on('close', () => {
    console.log('Relay connection closed');
    // Attempt reconnection after delay
    setTimeout(() => startRunner(config), 5000);
  });

  // Start job polling
  poller = new JobPoller(
    relayUrl.replace('wss://', 'https://').replace('ws://', 'http://'),
    token,
    jobPollInterval
  );

  poller.start(async (job) => {
    await executeJob(job);
  });
}

export async function stopRunner(): Promise<void> {
  if (poller) {
    poller.stop();
    poller = null;
  }

  if (ptyManager) {
    ptyManager.killAll();
    ptyManager = null;
  }

  if (relayConnection) {
    relayConnection.close();
    relayConnection = null;
  }

  if (logBatcher) {
    await logBatcher.flush();
    logBatcher = null;
  }
}

async function executeJob(job: Job): Promise<void> {
  const { id, ideaId, command, cwd } = job;

  // Create or attach to tmux session if enabled
  const sessionName = `coda-${ideaId}`;
  if (tmuxManager) {
    tmuxManager.createSession(sessionName, cwd);
  }

  // Spawn PTY process
  const ptyProcess = ptyManager!.spawn(id, command, cwd);

  // Stream output to logs
  ptyProcess.onData((data) => {
    logBatcher!.add({
      jobId: id,
      level: 'info',
      message: data,
      timestamp: new Date().toISOString(),
    });

    // Send output to relay for real-time display
    if (relayConnection?.readyState === WebSocket.OPEN) {
      relayConnection.send(JSON.stringify({
        type: 'output',
        sessionId: sessionName,
        data,
      }));
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    logBatcher!.add({
      jobId: id,
      level: exitCode === 0 ? 'info' : 'error',
      message: `Process exited with code ${exitCode}`,
      timestamp: new Date().toISOString(),
    });

    ptyManager!.kill(id);
  });
}

function handleRelayMessage(message: any): void {
  const { type, sessionId, data } = message;

  switch (type) {
    case 'input':
      // Forward input to PTY
      const ptyProcess = ptyManager!.get(sessionId);
      if (ptyProcess) {
        ptyProcess.write(data);
      }
      break;

    case 'resize':
      // Resize terminal
      const process = ptyManager!.get(sessionId);
      if (process) {
        process.resize(data.cols, data.rows);
      }
      break;
  }
}
```

## WebSocket Relay Server

**Location:** `relay/`

**Purpose:** Routes WebSocket messages between browser terminals and desktop runners without storing sensitive data.

**Deployment:** Fly.io (low-latency, global edge locations)

**Implementation:**

```typescript
// relay/index.ts
import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';

const wss = new WebSocketServer({ port: 8080 });

// Connection registry: sessionId → Set<WebSocket>
const sessions = new Map<string, Set<WebSocket>>();

// Metadata: WebSocket → ConnectionInfo
const connectionInfo = new Map<WebSocket, ConnectionInfo>();

interface ConnectionInfo {
  userId: string;
  sessionId: string;
  type: 'browser' | 'runner';
}

wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
  // Authenticate connection
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    ws.close(4001, 'Missing authorization token');
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    ws.close(4001, 'Invalid token');
    return;
  }

  const { userId, sessionId, type } = decoded;

  // Register connection
  connectionInfo.set(ws, { userId, sessionId, type });

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Set());
  }
  sessions.get(sessionId)!.add(ws);

  console.log(`[relay] ${type} connected: ${sessionId}`);

  // Handle messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (error) {
      console.error('[relay] Invalid message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    const info = connectionInfo.get(ws);
    if (info) {
      const sessionClients = sessions.get(info.sessionId);
      if (sessionClients) {
        sessionClients.delete(ws);
        if (sessionClients.size === 0) {
          sessions.delete(info.sessionId);
        }
      }
      connectionInfo.delete(ws);
      console.log(`[relay] ${info.type} disconnected: ${info.sessionId}`);
    }
  });
});

function handleMessage(sender: WebSocket, message: any): void {
  const senderInfo = connectionInfo.get(sender);
  if (!senderInfo) return;

  const { sessionId } = senderInfo;
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) return;

  // Broadcast to all other clients in the session
  for (const client of sessionClients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

console.log('[relay] WebSocket relay server started on port 8080');
```

**Deployment to Fly.io:**

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Initialize app
cd relay/
flyctl launch --name coda-relay

# Deploy
flyctl deploy

# Scale (if needed)
flyctl scale count 2 --region sjc,ord

# Monitor
flyctl logs
```

**fly.toml:**

```toml
app = "coda-relay"
primary_region = "sjc"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"
```

## Job Orchestration

### Job Lifecycle

```
1. User clicks "Run tests" in UI
         ↓
2. POST /api/devmode/jobs (creates job record)
         ↓
3. Runner polls /api/devmode/jobs (every 10s)
         ↓
4. Runner picks up job, spawns PTY process
         ↓
5. Runner streams logs to /api/devmode/logs/ingest
         ↓
6. Job completes, final status updated
         ↓
7. UI displays logs via /api/devmode/jobs/:id/logs
```

### API Endpoints

#### POST /api/devmode/jobs

**Purpose:** Create a new job for execution

**Request:**
```json
{
  "ideaId": "uuid",
  "command": "pnpm test",
  "cwd": "/path/to/project"
}
```

**Response:**
```json
{
  "id": "uuid",
  "ideaId": "uuid",
  "userId": "uuid",
  "command": "pnpm test",
  "cwd": "/path/to/project",
  "status": "pending",
  "createdAt": "2025-10-30T10:00:00Z"
}
```

**Implementation:**

```typescript
// app/api/devmode/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { devJobs } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ideaId, command, cwd } = body;

  // Validation
  if (!ideaId || !command) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Create job
  const [job] = await db.insert(devJobs).values({
    ideaId,
    userId: session.user.id,
    command,
    cwd: cwd || process.cwd(),
    status: 'pending',
  }).returning();

  return NextResponse.json(job, { status: 201 });
}

export async function GET(request: NextRequest) {
  // Authenticate runner
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const decoded = verifyJWT(token);

  if (!decoded) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Fetch pending jobs for this user
  const jobs = await db.query.devJobs.findMany({
    where: and(
      eq(devJobs.userId, decoded.userId),
      eq(devJobs.status, 'pending')
    ),
    limit: 10,
  });

  return NextResponse.json(jobs);
}
```

#### POST /api/devmode/logs/ingest

**Purpose:** Batch ingest logs from runner

**Request:**
```json
{
  "logs": [
    {
      "jobId": "uuid",
      "level": "info",
      "message": "Running tests...",
      "timestamp": "2025-10-30T10:00:01Z"
    },
    {
      "jobId": "uuid",
      "level": "info",
      "message": "✓ Test passed",
      "timestamp": "2025-10-30T10:00:02Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 2
}
```

**Implementation:**

```typescript
// app/api/devmode/logs/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { devLogs } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  // Authenticate runner
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const decoded = verifyJWT(token);

  if (!decoded) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await request.json();
  const { logs } = body;

  if (!Array.isArray(logs) || logs.length === 0) {
    return NextResponse.json({ error: 'Invalid logs' }, { status: 400 });
  }

  // Batch insert logs
  await db.insert(devLogs).values(logs);

  return NextResponse.json({ success: true, count: logs.length });
}
```

#### GET /api/devmode/logs/by-idea/:ideaId

**Purpose:** Fetch all logs for an idea (combined view)

**Response:**
```json
[
  {
    "jobId": "uuid",
    "command": "pnpm test",
    "level": "info",
    "message": "Running tests...",
    "timestamp": "2025-10-30T10:00:01Z"
  },
  {
    "jobId": "uuid",
    "command": "pnpm test",
    "level": "info",
    "message": "✓ Test passed",
    "timestamp": "2025-10-30T10:00:02Z"
  }
]
```

**Implementation:**

```typescript
// app/api/devmode/logs/by-idea/[ideaId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { devLogs, devJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { ideaId: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ideaId } = params;

  // Fetch logs with job details
  const logs = await db
    .select({
      jobId: devLogs.jobId,
      command: devJobs.command,
      level: devLogs.level,
      message: devLogs.message,
      timestamp: devLogs.timestamp,
    })
    .from(devLogs)
    .innerJoin(devJobs, eq(devLogs.jobId, devJobs.id))
    .where(eq(devJobs.ideaId, ideaId))
    .orderBy(devLogs.timestamp);

  return NextResponse.json(logs);
}
```

## Pairing Flow

### Overview

Runners must be paired with user accounts before they can execute jobs. This prevents unauthorized runners from accessing jobs.

### Pairing Steps

1. **Runner requests pairing code**
2. **API generates short-lived code (6 digits, 5-minute expiration)**
3. **User enters code in web UI**
4. **API approves pairing, issues JWT token**
5. **Runner uses JWT for all subsequent API calls**

### API Endpoints

#### POST /api/devmode/pair/request

**Request:**
```json
{
  "runnerType": "desktop",
  "runnerVersion": "1.0.0",
  "hostname": "MacBook-Pro"
}
```

**Response:**
```json
{
  "pairingCode": "123456",
  "expiresAt": "2025-10-30T10:05:00Z",
  "pollUrl": "/api/devmode/pair/status/abc123"
}
```

#### POST /api/devmode/pair/approve

**Request:**
```json
{
  "pairingCode": "123456"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "expiresAt": "2025-11-30T10:00:00Z"
}
```

#### GET /api/devmode/pair/status/:jti

**Purpose:** Long-polling endpoint for runner to check approval status

**Response (pending):**
```json
{
  "status": "pending"
}
```

**Response (approved):**
```json
{
  "status": "approved",
  "token": "jwt-token-here",
  "expiresAt": "2025-11-30T10:00:00Z"
}
```

## Terminal Synchronization

### tmux Integration

**Session Naming:** `coda-{ideaId}`

**Advantages:**
- Persistent sessions survive runner restarts
- Multiple clients can attach to same session
- Scrollback history preserved
- Copy/paste support

**Session Lifecycle:**

```typescript
// Create session on first job for idea
tmux new-session -d -s coda-abc123 -c /path/to/project

// Attach to existing session
tmux attach -t coda-abc123

// Send input to session
tmux send-keys -t coda-abc123 "pnpm test" Enter

// Capture pane output
tmux capture-pane -t coda-abc123 -p

// Kill session when idea deleted
tmux kill-session -t coda-abc123
```

### Browser Terminal (xterm.js)

**Component:** `app/dashboard/ideas/components/TerminalPane.tsx`

**Key Features:**
- WebSocket connection to relay
- Resize handling (debounced)
- Copy/paste support
- Scrollback buffer
- Theme customization

**Implementation:**

```typescript
// app/dashboard/ideas/components/TerminalPane.tsx
'use client'

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';

export function TerminalPane({ ideaId }: { ideaId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal>();
  const ws = useRef<WebSocket>();
  const fitAddon = useRef(new FitAddon());

  const [dimensions, setDimensions] = useState({ cols: 80, rows: 24 });
  const [debouncedDimensions] = useDebounce(dimensions, 500);

  useEffect(() => {
    // Initialize terminal
    terminal.current = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
    });

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(new WebLinksAddon());

    terminal.current.open(terminalRef.current!);
    fitAddon.current.fit();

    // Connect to relay
    const relayUrl = process.env.NEXT_PUBLIC_DEVMODE_RELAY_URL;
    const token = await getTerminalToken(ideaId);

    ws.current = new WebSocket(`${relayUrl}?token=${token}`);

    ws.current.onopen = () => {
      console.log('Terminal connected');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'output') {
        terminal.current?.write(message.data);
      }
    };

    ws.current.onerror = (error) => {
      console.error('Terminal error:', error);
    };

    ws.current.onclose = () => {
      console.log('Terminal disconnected');
    };

    // Handle input
    terminal.current.onData((data) => {
      ws.current?.send(JSON.stringify({
        type: 'input',
        sessionId: `coda-${ideaId}`,
        data,
      }));
    });

    // Handle resize
    terminal.current.onResize(({ cols, rows }) => {
      setDimensions({ cols, rows });
    });

    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.current.fit();
    });
    resizeObserver.observe(terminalRef.current!);

    return () => {
      terminal.current?.dispose();
      ws.current?.close();
      resizeObserver.disconnect();
    };
  }, [ideaId]);

  // Send resize events (debounced)
  useEffect(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'resize',
        sessionId: `coda-${ideaId}`,
        cols: debouncedDimensions.cols,
        rows: debouncedDimensions.rows,
      }));
    }
  }, [debouncedDimensions, ideaId]);

  return (
    <div className="terminal-pane">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
```

## Performance Optimizations

### Log Batching (Commit `62556ee`)

**Problem:** Individual log inserts caused excessive database load (1000+ writes/min)

**Solution:** Batch logs every 5 seconds or 50 logs, whichever comes first

**Results:**
- Database writes reduced by 90%
- Improved runner responsiveness
- Lower Postgres connection usage

### Resize Throttling (Commit `616484b`)

**Problem:** Terminal resize events triggered 100+ WebSocket messages per second, causing Cloudflare rate limiting

**Solution:** Debounce resize events to 500ms

**Results:**
- WebSocket messages reduced from 100+/sec to ~2/sec
- No more rate limit errors
- Terminal remains responsive

### Log Spam Reduction (Commit `3e078d9`)

**Problem:** Generic relay messages (`[relay] Received message`) flooded activity feed

**Solution:**
- Removed generic relay logging
- Suppressed noisy stdin messages
- Added severity-based filtering

**Results:**
- Activity feed shows only meaningful logs
- Improved UX for operators
- Reduced database growth rate

### Runner Polling Optimization (Commit `4a52066`)

**Problem:** 5-second polling interval caused excessive API load

**Solution:** Increased polling interval to 10 seconds, with exponential backoff for empty responses

**Results:**
- API requests reduced by 50%
- No impact on perceived responsiveness
- Lower Vercel function invocations

## Security Considerations

### Authentication

- **JWT tokens** for runner authentication
- **Short-lived pairing codes** (5 minutes)
- **Token expiration** (30 days, configurable)
- **HTTPS/WSS only** in production

### Authorization

- Runners can only access jobs for their paired user
- Web UI requires active session
- Log ingestion requires valid runner token

### Data Privacy

- Relay server does not persist messages
- Logs stored in encrypted Postgres
- No sensitive data in relay logs

### Rate Limiting

- Pairing requests: 3 per 5 minutes
- Job creation: 10 per minute
- Log ingestion: 1000 per minute

## Troubleshooting

### Runner won't connect

**Symptoms:** Runner shows "Disconnected" status

**Checks:**
1. Verify `NEXT_PUBLIC_DEVMODE_RELAY_URL` is correct
2. Check relay server is running (`flyctl status`)
3. Verify pairing token is valid (not expired)
4. Check firewall/proxy settings

### tmux sessions not persisting

**Symptoms:** Terminal history lost after runner restart

**Checks:**
1. Verify tmux is installed (`which tmux`)
2. Check tmux server is running (`tmux list-sessions`)
3. Verify session naming matches (`coda-{ideaId}`)

### Logs not appearing in UI

**Symptoms:** Runner executing jobs but logs not visible

**Checks:**
1. Verify `/api/devmode/logs/ingest` endpoint is accessible
2. Check runner has valid token for log ingestion
3. Verify database migrations applied (`dev_logs` table exists)
4. Check `.gitignore` doesn't exclude logs API routes

## Future Enhancements

### Planned Features

1. **Multi-runner support**: Distribute jobs across multiple runners
2. **Job queuing**: Priority-based job scheduling
3. **Runner telemetry**: Metrics on job execution times, failure rates
4. **Log search**: Full-text search across all logs
5. **Terminal playback**: Replay terminal sessions for debugging
6. **Collaborative terminals**: Multiple users in same session

### Technical Debt

1. Migrate from JWT to short-lived access + refresh tokens
2. Add comprehensive error tracking (Sentry)
3. Implement WebSocket reconnection with exponential backoff
4. Add E2E tests for relay protocol
5. Optimize tmux session management (automatic cleanup)

---

**Related Documents:**
- `01-architecture-deep-dive.md` - Overall system architecture
- `02-development-workflow.md` - Development practices
- `04-data-layer-schema.md` - Database schema for dev_* tables
- `07-security-compliance.md` - Security measures
