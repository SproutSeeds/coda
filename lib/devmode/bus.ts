import { EventEmitter } from "events";
import type { StreamEvent } from "./types";

const GLOBAL_KEY = Symbol.for("coda.devmode.bus");

type Bus = {
  emitter: EventEmitter;
};

function getGlobal(): Record<string | symbol, unknown> {
  // @ts-expect-error augmenting global
  if (!globalThis.__coda) {
    // @ts-expect-error augmenting global
    globalThis.__coda = {};
  }
  // @ts-expect-error augmenting global
  return globalThis.__coda as Record<string | symbol, unknown>;
}

export function getBus(): Bus {
  const g = getGlobal();
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { emitter: new EventEmitter() } as Bus;
  }
  return g[GLOBAL_KEY] as Bus;
}

export function publish(event: StreamEvent) {
  const { emitter } = getBus();
  emitter.emit(`job:${event.jobId}`, event);
}

export function subscribe(jobId: string, listener: (e: StreamEvent) => void) {
  const { emitter } = getBus();
  const key = `job:${jobId}`;
  emitter.on(key, listener);
  return () => emitter.off(key, listener);
}
