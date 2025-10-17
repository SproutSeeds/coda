"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type IdeaSectionState = {
  superstars: boolean;
  stars: boolean;
  unstarred: boolean;
};

export type IdeaSectionKey = keyof IdeaSectionState;

const DEFAULT_STATE: IdeaSectionState = {
  superstars: false,
  stars: false,
  unstarred: false,
};

export function useIdeaSectionCollapse(userId?: string) {
  const storageKey = useMemo(
    () => `coda:idea-sections:${userId ?? "anon"}`,
    [userId],
  );
  const [state, setState] = useState<IdeaSectionState>(DEFAULT_STATE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setState(DEFAULT_STATE);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<IdeaSectionState>;
      setState((previous) => ({
        ...previous,
        ...parsed,
      }));
    } catch {
      setState(DEFAULT_STATE);
    }
  }, [storageKey]);

  const updateState = useCallback(
    (value: IdeaSectionState | ((prev: IdeaSectionState) => IdeaSectionState)) => {
      setState((previous) => {
        const next =
          typeof value === "function" ? (value as (prev: IdeaSectionState) => IdeaSectionState)(previous) : value;
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // best-effort persistence
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return [state, updateState] as const;
}
