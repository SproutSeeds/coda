/**
 * Keyboard Shortcuts Zustand Store
 *
 * Manages shortcut state with localStorage persistence.
 * Users can customize bindings which are saved and restored.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ShortcutId, ShortcutBinding, ShortcutRegistry, ShortcutDefinition } from './types';
import { DEFAULT_SHORTCUTS } from './defaults';

interface ShortcutStore {
  /** Current shortcut bindings (may be customized by user) */
  shortcuts: ShortcutRegistry;

  /** Update a single shortcut's binding */
  updateShortcut: (id: ShortcutId, binding: ShortcutBinding) => void;

  /** Reset a single shortcut to its default */
  resetShortcut: (id: ShortcutId) => void;

  /** Reset all shortcuts to defaults */
  resetAll: () => void;

  /** Get the current binding for a shortcut */
  getBinding: (id: ShortcutId) => ShortcutBinding;

  /** Check if a shortcut has been customized */
  isCustomized: (id: ShortcutId) => boolean;
}

// Deep clone the defaults to avoid mutation
function cloneDefaults(): ShortcutRegistry {
  const cloned: Record<string, ShortcutDefinition> = {};
  for (const [id, def] of Object.entries(DEFAULT_SHORTCUTS)) {
    cloned[id] = {
      ...def,
      default: { ...def.default, modifiers: def.default.modifiers ? { ...def.default.modifiers } : undefined },
      current: { ...def.current, modifiers: def.current.modifiers ? { ...def.current.modifiers } : undefined },
    };
  }
  return cloned as ShortcutRegistry;
}

// Compare two bindings for equality
function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  if (a.key.toLowerCase() !== b.key.toLowerCase()) return false;
  if (!!a.modifiers?.shift !== !!b.modifiers?.shift) return false;
  if (!!a.modifiers?.ctrl !== !!b.modifiers?.ctrl) return false;
  if (!!a.modifiers?.alt !== !!b.modifiers?.alt) return false;
  if (!!a.modifiers?.meta !== !!b.modifiers?.meta) return false;
  if (JSON.stringify(a.sequence) !== JSON.stringify(b.sequence)) return false;
  return true;
}

// Type for persisted state (only stores current bindings)
interface PersistedShortcuts {
  shortcuts: Record<string, { current: ShortcutBinding }>;
}

export const useShortcutStore = create<ShortcutStore>()(
  persist(
    (set, get) => ({
      shortcuts: cloneDefaults(),

      updateShortcut: (id: ShortcutId, binding: ShortcutBinding) => {
        set((state: ShortcutStore) => ({
          shortcuts: {
            ...state.shortcuts,
            [id]: {
              ...state.shortcuts[id],
              current: {
                ...binding,
                modifiers: binding.modifiers ? { ...binding.modifiers } : undefined,
              },
            },
          },
        }));
      },

      resetShortcut: (id: ShortcutId) => {
        set((state: ShortcutStore) => ({
          shortcuts: {
            ...state.shortcuts,
            [id]: {
              ...state.shortcuts[id],
              current: {
                ...state.shortcuts[id].default,
                modifiers: state.shortcuts[id].default.modifiers
                  ? { ...state.shortcuts[id].default.modifiers }
                  : undefined,
              },
            },
          },
        }));
      },

      resetAll: () => {
        set({ shortcuts: cloneDefaults() });
      },

      getBinding: (id: ShortcutId) => {
        return get().shortcuts[id]?.current ?? DEFAULT_SHORTCUTS[id].default;
      },

      isCustomized: (id: ShortcutId) => {
        const shortcut = get().shortcuts[id];
        if (!shortcut) return false;
        return !bindingsEqual(shortcut.current, shortcut.default);
      },
    }),
    {
      name: 'coda-shortcuts',
      storage: createJSONStorage(() => localStorage),
      // Only persist the current bindings, not the full definitions
      partialize: (state: ShortcutStore): PersistedShortcuts => ({
        shortcuts: Object.fromEntries(
          Object.entries(state.shortcuts).map(([id, def]) => [
            id,
            { current: def.current },
          ])
        ),
      }),
      // Merge persisted bindings back into full definitions
      merge: (persisted, current) => {
        const persistedState = persisted as PersistedShortcuts | undefined;
        const currentState = current as ShortcutStore;

        if (!persistedState?.shortcuts) return currentState;

        const merged = cloneDefaults();
        for (const [id, saved] of Object.entries(persistedState.shortcuts)) {
          const shortcutId = id as ShortcutId;
          if (merged[shortcutId] && saved.current) {
            merged[shortcutId].current = {
              ...saved.current,
              modifiers: saved.current.modifiers ? { ...saved.current.modifiers } : undefined,
            };
          }
        }

        return { ...currentState, shortcuts: merged };
      },
    }
  )
);

// Selector hooks for specific data
export function useShortcutBinding(id: ShortcutId): ShortcutBinding {
  return useShortcutStore((state: ShortcutStore) => state.shortcuts[id]?.current ?? DEFAULT_SHORTCUTS[id].default);
}

export function useShortcutLabel(id: ShortcutId): string {
  return useShortcutStore((state: ShortcutStore) => state.shortcuts[id]?.label ?? DEFAULT_SHORTCUTS[id].label);
}

export function useAllShortcuts(): ShortcutRegistry {
  return useShortcutStore((state: ShortcutStore) => state.shortcuts);
}
