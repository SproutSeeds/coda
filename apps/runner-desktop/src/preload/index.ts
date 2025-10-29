import { contextBridge, ipcRenderer } from "electron";
import type {
  PairingCodePayload,
  PairingSuccessPayload,
  RunnerLogEntry,
  RunnerStatus,
  ActiveSession,
} from "@coda/runner-core";

type RunnerSnapshot = {
  status: RunnerStatus;
  logs: Array<RunnerLogEntry & { timestamp: string }>;
  pairingCode: PairingCodePayload | null;
  activeSessions: ActiveSession[];
};

type RunnerSettings = {
  baseUrl: string;
  relayUrl: string;
  deviceId: string;
  deviceName: string;
};

type Unsubscribe = () => void;

const api = {
  getSettings: () => ipcRenderer.invoke("runner:get-settings") as Promise<RunnerSettings>,
  saveSettings: (settings: RunnerSettings) => ipcRenderer.invoke("runner:save-settings", settings) as Promise<void>,
  getSnapshot: () => ipcRenderer.invoke("runner:get-snapshot") as Promise<RunnerSnapshot>,
  start: () => ipcRenderer.invoke("runner:start") as Promise<RunnerSnapshot>,
  stop: () => ipcRenderer.invoke("runner:stop") as Promise<RunnerSnapshot>,
  clearToken: () => ipcRenderer.invoke("runner:clear-token") as Promise<void>,
  openPairPage: (url: string) => ipcRenderer.invoke("runner:open-pair", url) as Promise<void>,
  onStatus: (handler: (status: RunnerStatus) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, status: RunnerStatus) => handler(status);
    ipcRenderer.on("runner:status", listener);
    return () => ipcRenderer.removeListener("runner:status", listener);
  },
  onLog: (handler: (entry: RunnerLogEntry & { timestamp: string }) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, entry: RunnerLogEntry & { timestamp: string }) => handler(entry);
    ipcRenderer.on("runner:log", listener);
    return () => ipcRenderer.removeListener("runner:log", listener);
  },
  onPairingCode: (handler: (payload: PairingCodePayload) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PairingCodePayload) => handler(payload);
    ipcRenderer.on("runner:pairing-code", listener);
    return () => ipcRenderer.removeListener("runner:pairing-code", listener);
  },
  onPairingSuccess: (handler: (payload: PairingSuccessPayload) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PairingSuccessPayload) => handler(payload);
    ipcRenderer.on("runner:pairing-success", listener);
    return () => ipcRenderer.removeListener("runner:pairing-success", listener);
  },
  onError: (handler: (message: string) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { message: string }) => handler(payload.message);
    ipcRenderer.on("runner:error", listener);
    return () => ipcRenderer.removeListener("runner:error", listener);
  },
};

contextBridge.exposeInMainWorld("runner", api);

declare global {
  interface Window {
    runner: typeof api;
  }
}
