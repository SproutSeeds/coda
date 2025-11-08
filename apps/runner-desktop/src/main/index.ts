import path from "node:path";
import os from "node:os";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import {
  startRunner,
  type PairingCodePayload,
  type PairingSuccessPayload,
  type RunnerHandle,
  type RunnerLogEntry,
  type RunnerStatus,
  type RunnerTokenStore,
} from "@coda/runner-core";

const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

type RunnerSettings = {
  baseUrl: string;
  relayUrl: string;
  deviceId: string;
  deviceName: string;
};

type RunnerStoreShape = {
  settings?: RunnerSettings;
  token?: {
    runnerToken: string;
    runnerId: string;
    relayUrl?: string;
  };
};

type ElectronStore = {
  get<K extends keyof RunnerStoreShape>(key: K): RunnerStoreShape[K] | undefined;
  set<K extends keyof RunnerStoreShape>(key: K, value: RunnerStoreShape[K]): void;
  delete(key: keyof RunnerStoreShape | string): void;
};

const dynamicImport = new Function(
  "specifier",
  "return import(specifier);",
) as <T = unknown>(specifier: string) => Promise<T>;

let electronStorePromise: Promise<ElectronStore> | null = null;
function getStore(): Promise<ElectronStore> {
  if (!electronStorePromise) {
    electronStorePromise = dynamicImport<typeof import("electron-store")>("electron-store").then(({ default: StoreConstructor }) => {
      const rawStore = new StoreConstructor<RunnerStoreShape>({ name: "runner-settings" });
      const store = rawStore as unknown as {
        get: <K extends string>(key: K) => unknown;
        set: (key: string, value: unknown) => void;
        delete: (key: string) => void;
      };
      return {
        get: store.get.bind(store),
        set: store.set.bind(store),
        delete: store.delete.bind(store),
      } as ElectronStore;
    });
  }
  return electronStorePromise;
}

const DEFAULT_SETTINGS = (): RunnerSettings => ({
  baseUrl: process.env.RUNNER_DEFAULT_BASE_URL || "https://codacli.com",
  relayUrl: process.env.RUNNER_DEFAULT_RELAY_URL || "wss://relay-falling-butterfly-779.fly.dev",
  deviceId: process.env.RUNNER_DEFAULT_DEVICE_ID || `${os.hostname()}-${os.userInfo().username}`,
  deviceName: process.env.RUNNER_DEFAULT_DEVICE_NAME || os.userInfo().username || "Desktop Runner",
});


type RendererChannel =
  | "runner:status"
  | "runner:log"
  | "runner:pairing-code"
  | "runner:pairing-success"
  | "runner:error";

interface UIEventMap {
  "runner:status": RunnerStatus;
  "runner:log": RunnerLogEntry & { timestamp: string };
  "runner:pairing-code": PairingCodePayload;
  "runner:pairing-success": PairingSuccessPayload;
  "runner:error": { message: string };
}

class RunnerManager {
  private handle: RunnerHandle | null = null;
  private status: RunnerStatus = "stopped";
  private logs: Array<RunnerLogEntry & { timestamp: string }> = [];
  private pairingCode: PairingCodePayload | null = null;
  private settings: RunnerSettings;
  private isRestarting = false;
  private isStarting = false;

  constructor(private getWindow: () => BrowserWindow | null) {
    this.settings = DEFAULT_SETTINGS();
    void this.restoreSettingsFromStore();
  }

  getSettings(): RunnerSettings {
    return this.settings;
  }

  private async restoreSettingsFromStore() {
    try {
      const store = await getStore();
      const stored = store.get("settings");
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS(), ...stored };
      } else {
        this.settings = DEFAULT_SETTINGS();
      }
    } catch (error) {
      console.warn("Failed to restore runner settings", error);
    }
  }

  async saveSettings(next: RunnerSettings) {
    this.settings = next;
    try {
      const store = await getStore();
      store.set("settings", next);
      if (this.handle && !this.isRestarting) {
        this.isRestarting = true;
        try {
          await this.stop();
          await this.start();
        } finally {
          this.isRestarting = false;
        }
      }
    } catch (error) {
      console.warn("Failed to persist runner settings", error);
    }
  }

  getStatusSnapshot() {
    return {
      status: this.status,
      logs: this.logs,
      pairingCode: this.pairingCode,
      activeSessions: (this.handle && typeof this.handle.getActiveSessions === 'function') ? this.handle.getActiveSessions() : [],
    };
  }

  private sendToRenderer<K extends RendererChannel>(channel: K, payload: UIEventMap[K]) {
    const win = this.getWindow();
    if (!win) return;
    win.webContents.send(channel, payload);
  }

  private setStatus(status: RunnerStatus) {
    this.status = status;
    this.sendToRenderer("runner:status", status);
  }

  private appendLog(entry: RunnerLogEntry) {
    const enriched = { ...entry, timestamp: new Date().toISOString() };
    this.logs = [...this.logs, enriched].slice(-200);
    this.sendToRenderer("runner:log", enriched);
  }

  private get tokenStore(): RunnerTokenStore {
    return {
      load: async () => {
        try {
          const store = await getStore();
          return store.get("token") ?? null;
        } catch (error) {
          console.warn("Failed to load stored runner token", error);
          return null;
        }
      },
      save: async (payload) => {
        try {
          const store = await getStore();
          store.set("token", payload);
        } catch (error) {
          console.warn("Failed to persist runner token", error);
        }
      },
      clear: async () => {
        try {
          const store = await getStore();
          store.delete("token");
        } catch (error) {
          console.warn("Failed to clear runner token", error);
        }
      },
    };
  }

  async start() {
    if (this.isStarting) {
      console.log("[RunnerManager] Already starting, ignoring duplicate start() call");
      return;
    }
    if (this.handle) {
      console.log("[RunnerManager] Already running, ignoring duplicate start() call");
      return;
    }
    console.log("[RunnerManager] Starting runner...");
    this.logs = [];
    this.pairingCode = null;
    this.setStatus("initializing");
    const settings = this.settings;

    const sessionPrefix = `coda-runner-${settings.deviceId}`;
    const env = {
      ...process.env,
      BASE_URL: settings.baseUrl,
      DEV_RUNNER_ID: settings.deviceId,
      DEV_RUNNER_NAME: settings.deviceName,
      RELAY_URL: settings.relayUrl,
      TTY_SYNC: "tmux",
      TTY_SESSION_PREFIX: sessionPrefix,
    };

    this.isStarting = true;
    try {
      this.handle = await startRunner({
        baseUrl: settings.baseUrl,
        runnerId: settings.deviceId,
        runnerName: settings.deviceName,
        relay: { url: settings.relayUrl },
        env,
        enableTTY: true,
        tty: { sync: "tmux", sessionPrefix },
        logger: {
          info: (message, context) => { /* handled by onLog */ },
          warn: (message, context) => { /* handled by onLog */ },
          error: (message, context) => { /* handled by onLog */ },
        },
        tokenStore: {
          load: this.tokenStore.load,
          save: async (payload) => {
            await this.tokenStore.save(payload);
          },
          clear: this.tokenStore.clear,
        },
        events: {
          onStatusChange: (status) => this.setStatus(status),
          onPairingCode: (payload) => {
            this.pairingCode = payload;
            this.sendToRenderer("runner:pairing-code", payload);
          },
          onPairingSuccess: (payload) => {
            this.pairingCode = null;
            this.sendToRenderer("runner:pairing-success", payload);
          },
          onLog: (entry) => this.appendLog(entry),
          onError: (error) => this.sendToRenderer("runner:error", { message: error.message }),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus("error");
      this.appendLog({ level: "error", message, context: { stack: (err as Error)?.stack } });
      throw err;
    } finally {
      this.isStarting = false;
    }
  }

  async stop() {
    if (!this.handle) return;
    await this.handle.stop();
    this.handle = null;
    // Clear the stored token to force a new pairing code on next start
    await this.clearToken();
    // Clear the pairing code from UI state and notify renderer
    this.pairingCode = null;
    this.sendToRenderer("runner:pairing-code", null as any); // Notify UI that pairing code is cleared
    this.setStatus("stopped");
  }

  async clearToken() {
    await this.tokenStore.clear?.();
  }
}

let mainWindow: BrowserWindow | null = null;
const runnerManager = new RunnerManager(() => mainWindow);

function getPreloadPath() {
  return path.join(__dirname, "..", "preload", "index.js");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f172a" : "#f5f7fb",
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev && VITE_DEV_SERVER_URL ? `${VITE_DEV_SERVER_URL}` : path.join(__dirname, "..", "renderer", "index.html");
  if (url.startsWith("http")) {
    await mainWindow.loadURL(url);
  } else {
    await mainWindow.loadFile(url);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(async () => {
  await createWindow();
  // Don't auto-start the runner on app launch
  // User must explicitly click "Start Runner" button
  // This prevents duplicate tmux sessions on app restart

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Always quit when window closes - don't keep running in background
  app.quit();
});

app.on("before-quit", async () => {
  // Ensure runner stops cleanly on quit
  await runnerManager.stop();
});

ipcMain.handle("runner:get-settings", async () => {
  return runnerManager.getSettings();
});

ipcMain.handle("runner:save-settings", async (_event, settings: RunnerSettings) => {
  await runnerManager.saveSettings(settings);
  return true;
});

ipcMain.handle("runner:get-snapshot", async () => {
  return runnerManager.getStatusSnapshot();
});

ipcMain.handle("runner:start", async () => {
  console.log("[Main IPC] runner:start called");
  await runnerManager.start();
  const snapshot = runnerManager.getStatusSnapshot();
  console.log("[Main IPC] runner:start returning snapshot:", snapshot);
  return snapshot;
});

ipcMain.handle("runner:stop", async () => {
  await runnerManager.stop();
  return runnerManager.getStatusSnapshot();
});

ipcMain.handle("runner:open-pair", async (_event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle("runner:clear-token", async () => {
  await runnerManager.clearToken();
});

function buildTmuxExecEnv() {
  const extendedPath = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    process.env.PATH || "",
  ]
    .filter(Boolean)
    .join(":");

  return { ...process.env, PATH: extendedPath };
}

ipcMain.handle("runner:list-tmux-sessions", async () => {
  const { execSync } = await import("child_process");
  try {
    const execOptions = {
      encoding: "utf8" as const,
      stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
      env: buildTmuxExecEnv(),
    };
    const output = execSync("tmux list-sessions -F '#{session_name}|#{session_created}|#{session_attached}'", execOptions);
    const sessions = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, created, attached] = line.split("|");
        const attachedCount = Number(attached);
        return {
          name,
          created: parseInt(created, 10) * 1000, // Convert to milliseconds
          attached: Number.isFinite(attachedCount) ? attachedCount > 0 : attached === "1",
          attachedCount: Number.isFinite(attachedCount) ? attachedCount : undefined,
        };
      });
    console.log("[main] list-tmux-sessions", sessions);
    return sessions;
  } catch (error) {
    console.warn("[main] list-tmux-sessions failed", error);
    // No sessions or tmux not available
    return [];
  }
});

ipcMain.handle("runner:kill-tmux-session", async (_event, sessionName: string) => {
  const { execSync } = await import("child_process");
  try {
    execSync(`tmux kill-session -t ${JSON.stringify(sessionName)}`, {
      stdio: "ignore",
      env: buildTmuxExecEnv(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("runner:kill-all-tmux-sessions", async () => {
  const { execSync } = await import("child_process");
  try {
    // Only kill Coda-related sessions, not all tmux sessions on the system
    // List all sessions, filter for coda-runner prefix, and kill each one
    const sessions = execSync("tmux list-sessions -F '#{session_name}'", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      env: buildTmuxExecEnv(),
    }).trim();

    const codaSessions = sessions
      .split("\n")
      .filter(name => name.startsWith("coda-runner-") || name.startsWith("coda-"));

    let killedCount = 0;
    for (const sessionName of codaSessions) {
      try {
        execSync(`tmux kill-session -t ${JSON.stringify(sessionName)}`, {
          stdio: "ignore",
          env: buildTmuxExecEnv(),
        });
        killedCount++;
      } catch {
        // Ignore errors for individual sessions that may have already closed
      }
    }

    return { success: true, killedCount };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
