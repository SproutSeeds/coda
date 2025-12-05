"use client";

import type { ParticleShape } from "@/components/effects/TubesEffect";

const DB_NAME = "coda-scene-snapshots";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

/**
 * Settings type matching ModeSettings in GlobalVisualShell.tsx
 */
export interface SnapshotSettings {
  backgroundColor: string;
  tubeSpeed: number;
  particleSpeed: number;
  tubesOpacity: number;
  particlesOpacity: number;
  colorIntensity: number;
  mouseFollow: boolean;
  enableCollision: boolean;
  collisionRadius: number;
  collisionStrength: number;
  panelOpacity: number;
  customTubeColors: string[] | null;
  idleTimeout: number;
  tubeRadius: number;
  particleCount: number;
  pulseOnClick: boolean;
  fogIntensity: number;
  particleShape: ParticleShape;
  particleRotation: number;
  enableFlightControls: boolean;
  flightSpeed: number;
  lookSensitivity: number;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  distance: number;
  orbitOffset: { x: number; y: number };
}

export interface ParticleData {
  count: number;
  nextIndex: number;
  positions: string; // Base64 encoded Float32Array
  colors: string;
  sizes: string;
  lifetimes: string;
  maxLifetimes: string;
  velocities: string;
}

export interface LocalSnapshot {
  id: string;
  name: string;
  createdAt: number;
  settings: SnapshotSettings;
  camera: CameraState;
  particles: ParticleData;
  thumbnail?: string; // JPEG data URL
}

// Metadata-only type for listing (excludes large particle data)
export type LocalSnapshotMeta = Omit<LocalSnapshot, "particles">;

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== "undefined" && "indexedDB" in window;
  } catch {
    return false;
  }
}

/**
 * Open or create the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create snapshots store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };
  });
}

/**
 * Generate a unique ID for snapshots
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Encode a Float32Array to base64 string
 */
export function encodeFloat32Array(arr: Float32Array): string {
  const uint8 = new Uint8Array(arr.buffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string back to Float32Array
 */
export function decodeFloat32Array(base64: string): Float32Array {
  const binary = atob(base64);
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8[i] = binary.charCodeAt(i);
  }
  return new Float32Array(uint8.buffer);
}

/**
 * Save a new snapshot to IndexedDB
 * No limit on number of snapshots - user can save unlimited locally
 */
export async function saveSnapshot(
  snapshot: Omit<LocalSnapshot, "id" | "createdAt">
): Promise<LocalSnapshot> {
  const db = await openDB();

  const fullSnapshot: LocalSnapshot = {
    ...snapshot,
    id: generateId(),
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(fullSnapshot);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(fullSnapshot);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * List all snapshots (metadata only, without particle data for performance)
 */
export async function listSnapshots(): Promise<LocalSnapshotMeta[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("createdAt");
    const request = index.openCursor(null, "prev"); // Newest first

    const snapshots: LocalSnapshotMeta[] = [];

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const { particles: _particles, ...meta } = cursor.value as LocalSnapshot;
        snapshots.push(meta);
        cursor.continue();
      } else {
        resolve(snapshots);
      }
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get a single snapshot by ID (includes particle data)
 */
export async function getSnapshot(id: string): Promise<LocalSnapshot | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete a snapshot by ID
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Rename a snapshot
 */
export async function renameSnapshot(id: string, name: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const snapshot = getRequest.result as LocalSnapshot | undefined;
      if (!snapshot) {
        reject(new Error("Snapshot not found"));
        return;
      }

      snapshot.name = name;
      const putRequest = store.put(snapshot);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get total count of snapshots
 */
export async function getSnapshotCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all snapshots (use with caution!)
 */
export async function clearAllSnapshots(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}
