/**
 * Keyboard Shortcut Hooks
 *
 * Custom hooks for working with keyboard shortcuts in components.
 * Provides matching logic and formatted display strings.
 */

'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { ShortcutId, ShortcutBinding, ShortcutDefinition, ShortcutRegistry } from './types';
import { useShortcutStore, useShortcutBinding, useShortcutLabel } from './store';

/**
 * Format a binding for display (e.g., "Shift + Space", "W")
 */
export function formatBinding(binding: ShortcutBinding): string {
  const parts: string[] = [];

  // Add modifiers in consistent order
  if (binding.modifiers?.ctrl) parts.push('Ctrl');
  if (binding.modifiers?.alt) parts.push('Alt');
  if (binding.modifiers?.shift) parts.push('Shift');
  if (binding.modifiers?.meta) parts.push('\u2318'); // ⌘ symbol

  // Handle sequence shortcuts
  if (binding.sequence && binding.sequence.length > 0) {
    return parts.join(' + ') + ' + ' + binding.sequence.join('');
  }

  // Format the main key
  let keyDisplay = binding.key;
  if (binding.key === ' ') keyDisplay = 'Space';
  else if (binding.key === 'Escape') keyDisplay = 'Esc';
  else if (binding.key === 'ArrowUp') keyDisplay = '\u2191';
  else if (binding.key === 'ArrowDown') keyDisplay = '\u2193';
  else if (binding.key === 'ArrowLeft') keyDisplay = '\u2190';
  else if (binding.key === 'ArrowRight') keyDisplay = '\u2192';
  else if (binding.key.length === 1) keyDisplay = binding.key.toUpperCase();

  parts.push(keyDisplay);
  return parts.join(' + ');
}

/**
 * Check if a keyboard event matches a binding
 */
export function matchesBinding(e: KeyboardEvent, binding: ShortcutBinding): boolean {
  // For sequence shortcuts, we don't match directly - they need special handling
  if (binding.sequence) {
    return false;
  }

  // Check the main key
  const eventKey = e.key.toLowerCase();
  const bindingKey = binding.key.toLowerCase();

  if (eventKey !== bindingKey) return false;

  // Check modifiers - must match exactly
  const shiftRequired = binding.modifiers?.shift ?? false;
  const ctrlRequired = binding.modifiers?.ctrl ?? false;
  const altRequired = binding.modifiers?.alt ?? false;
  const metaRequired = binding.modifiers?.meta ?? false;

  if (e.shiftKey !== shiftRequired) return false;
  if (e.ctrlKey !== ctrlRequired) return false;
  if (e.altKey !== altRequired) return false;
  if (e.metaKey !== metaRequired) return false;

  return true;
}

interface ShortcutStore {
  shortcuts: ShortcutRegistry;
}

/**
 * Hook to get shortcut info and matching function
 */
export function useShortcut(id: ShortcutId) {
  const binding = useShortcutBinding(id);
  const label = useShortcutLabel(id);
  const definition = useShortcutStore((state: ShortcutStore) => state.shortcuts[id]);

  const matches = useCallback(
    (e: KeyboardEvent) => matchesBinding(e, binding),
    [binding]
  );

  const formatted = useMemo(() => formatBinding(binding), [binding]);

  return {
    /** Check if a keyboard event matches this shortcut */
    matches,
    /** The current binding configuration */
    binding,
    /** Display label for the shortcut */
    label,
    /** Formatted key combination string for display */
    formatted,
    /** Full shortcut definition */
    definition,
  };
}

/**
 * Hook for handling sequence shortcuts (like Shift+ZEN, Shift+FLY)
 *
 * @param id - The shortcut ID
 * @param onTrigger - Callback when sequence is completed
 */
export function useSequenceShortcut(
  id: ShortcutId,
  onTrigger: () => void
) {
  const binding = useShortcutBinding(id);
  const [buffer, setBuffer] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the sequence or empty array
  const sequence = binding.sequence ?? [];
  const targetSequence = sequence.join('').toUpperCase();

  useEffect(() => {
    if (!targetSequence) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Sequence shortcuts require Shift to be held
      if (!e.shiftKey) {
        setBuffer('');
        return;
      }

      // Ignore the Shift key itself
      if (e.key === 'Shift') return;

      const key = e.key.toUpperCase();

      // Only accept letters that are part of potential sequences
      if (!/^[A-Z]$/.test(key)) {
        setBuffer('');
        return;
      }

      const newBuffer = buffer + key;
      setBuffer(newBuffer);

      // Clear buffer after 2 seconds of inactivity
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setBuffer(''), 2000);

      // Check if we completed the sequence
      if (newBuffer === targetSequence) {
        e.preventDefault();
        setBuffer('');
        onTrigger();
      } else if (!targetSequence.startsWith(newBuffer)) {
        // Reset if we've gone off track
        setBuffer('');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setBuffer('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [targetSequence, buffer, onTrigger]);

  return {
    buffer,
    targetSequence,
    formatted: formatBinding(binding),
  };
}

// Flight shortcut IDs - defined outside component to avoid dependency issues
const FLIGHT_SHORTCUT_IDS: readonly ShortcutId[] = [
  'moveForward',
  'moveBackward',
  'moveLeft',
  'moveRight',
  'moveUp',
  'moveDown',
] as const;

/**
 * Hook for flight control keys that need to track held state
 * Returns a Set of currently held shortcut IDs
 */
export function useFlightKeys() {
  const shortcuts = useShortcutStore((state: ShortcutStore) => state.shortcuts);
  const [heldKeys, setHeldKeys] = useState<Set<ShortcutId>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const id of FLIGHT_SHORTCUT_IDS) {
        const binding = shortcuts[id]?.current;
        if (binding && matchesBinding(e, binding)) {
          setHeldKeys((prev) => new Set([...prev, id]));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const releasedKey = e.key.toLowerCase();
      setHeldKeys((prev) => {
        const next = new Set<ShortcutId>();
        prev.forEach((id) => {
          const binding = shortcuts[id]?.current;
          if (binding && binding.key.toLowerCase() !== releasedKey) {
            next.add(id);
          }
        });
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [shortcuts]);

  return heldKeys;
}

/**
 * Get all shortcuts with their formatted bindings
 */
export function useFormattedShortcuts(): Array<ShortcutDefinition & { formatted: string }> {
  const shortcuts = useShortcutStore((state: ShortcutStore) => state.shortcuts);

  return useMemo(() => {
    return Object.values(shortcuts).map((def: ShortcutDefinition) => ({
      ...def,
      formatted: formatBinding(def.current),
    }));
  }, [shortcuts]);
}

// Re-export types for convenience
export type { ShortcutId, ShortcutBinding, ShortcutDefinition };
