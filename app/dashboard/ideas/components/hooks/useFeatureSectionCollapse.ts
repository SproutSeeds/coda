"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type FeatureSectionState = {
  superstars: boolean;
  stars: boolean;
  unstarred: boolean;
};

export type FeatureSectionKey = keyof FeatureSectionState;

const DEFAULT_STATE: FeatureSectionState = {
  superstars: false,
  stars: false,
  unstarred: false,
};

export function useFeatureSectionCollapse(ideaId: string) {
  const storageKey = useMemo(() => `coda:feature-sections:${ideaId}`, [ideaId]);
  const [state, setState] = useState<FeatureSectionState>(DEFAULT_STATE);

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
      const parsed = JSON.parse(raw) as Partial<FeatureSectionState>;
      setState((previous) => ({
        ...previous,
        ...parsed,
      }));
    } catch {
      setState(DEFAULT_STATE);
    }
  }, [storageKey]);

  const updateState = useCallback(
    (value: FeatureSectionState | ((prev: FeatureSectionState) => FeatureSectionState)) => {
      setState((previous) => {
        const next =
          typeof value === "function" ? (value as (prev: FeatureSectionState) => FeatureSectionState)(previous) : value;
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // Persistence is best-effort; ignore failures.
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return [state, updateState] as const;
}
