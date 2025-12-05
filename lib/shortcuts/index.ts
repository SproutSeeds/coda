/**
 * Keyboard Shortcuts Module
 *
 * Centralized system for customizable keyboard shortcuts.
 *
 * Usage:
 * ```tsx
 * import { useShortcut, formatBinding } from '@/lib/shortcuts';
 *
 * function MyComponent() {
 *   const { matches, formatted } = useShortcut('moveForward');
 *
 *   useEffect(() => {
 *     const handler = (e: KeyboardEvent) => {
 *       if (matches(e)) {
 *         // Handle the shortcut
 *       }
 *     };
 *     window.addEventListener('keydown', handler);
 *     return () => window.removeEventListener('keydown', handler);
 *   }, [matches]);
 *
 *   return <span>Press {formatted} to move forward</span>;
 * }
 * ```
 */

// Types
export type {
  ShortcutId,
  ShortcutBinding,
  ShortcutDefinition,
  ShortcutCategory,
  ShortcutRegistry,
} from './types';

export { CATEGORY_LABELS } from './types';

// Defaults
export { DEFAULT_SHORTCUTS, getShortcutsArray, getShortcutsByCategory } from './defaults';

// Store
export {
  useShortcutStore,
  useShortcutBinding,
  useShortcutLabel,
  useAllShortcuts,
} from './store';

// Hooks
export {
  useShortcut,
  useSequenceShortcut,
  useFlightKeys,
  useFormattedShortcuts,
  formatBinding,
  matchesBinding,
} from './hooks';
