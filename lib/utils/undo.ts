import crypto from "node:crypto";

export type UndoTokenRecord = {
  token: string;
  ideaId: string;
  expiresAt: Date;
};

const UNDO_WINDOW_MS = 10_000;
const store = new Map<string, UndoTokenRecord>();

export function createUndoToken(ideaId: string): UndoTokenRecord {
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + UNDO_WINDOW_MS);
  const record = { token, ideaId, expiresAt };
  store.set(token, record);
  return record;
}

export function isUndoTokenExpired(record: UndoTokenRecord, now: Date = new Date()): boolean {
  return record.expiresAt.getTime() <= now.getTime();
}

export async function purgeExpiredUndoTokens(now: Date = new Date()): Promise<number> {
  let removed = 0;
  for (const [token, record] of store.entries()) {
    if (isUndoTokenExpired(record, now)) {
      store.delete(token);
      removed += 1;
    }
  }
  return removed;
}

export function consumeUndoToken(token: string): UndoTokenRecord | undefined {
  const record = store.get(token);
  if (!record) return undefined;
  if (isUndoTokenExpired(record)) {
    store.delete(token);
    return undefined;
  }
  store.delete(token);
  return record;
}

export function resetUndoStore() {
  store.clear();
}

export function seedUndoToken(record: UndoTokenRecord) {
  store.set(record.token, record);
}
