/**
 * Default Keyboard Shortcut Bindings
 *
 * This file defines the default key bindings for all shortcuts.
 * Users can customize these, which are stored separately in localStorage.
 */

import type { ShortcutDefinition, ShortcutRegistry } from './types';

// Helper to create a shortcut definition with defaults
function defineShortcut(
  def: Omit<ShortcutDefinition, 'current'>
): ShortcutDefinition {
  return {
    ...def,
    current: { ...def.default },
  };
}

export const DEFAULT_SHORTCUTS: ShortcutRegistry = {
  // ============================================
  // GLOBAL UI SHORTCUTS
  // ============================================
  dismiss: defineShortcut({
    id: 'dismiss',
    label: 'Dismiss / Cancel',
    description: 'Close panels, exit edit mode, cancel actions',
    category: 'ui',
    default: { key: 'Escape' },
  }),

  submit: defineShortcut({
    id: 'submit',
    label: 'Submit',
    description: 'Submit forms and confirm inputs',
    category: 'ui',
    default: { key: 'Enter' },
  }),

  newline: defineShortcut({
    id: 'newline',
    label: 'New Line',
    description: 'Insert line break in text areas',
    category: 'ui',
    default: { key: 'Enter', modifiers: { shift: true } },
  }),

  // ============================================
  // ANIMATION CONTROL
  // ============================================
  freeze: defineShortcut({
    id: 'freeze',
    label: 'Freeze Animation',
    description: 'Toggle freeze mode (stop all motion)',
    category: 'animation',
    default: { key: ' ', modifiers: { shift: true } },
  }),

  // ============================================
  // ZEN MODE
  // ============================================
  zenMode: defineShortcut({
    id: 'zenMode',
    label: 'Enter Zen Mode',
    description: 'Hide all UI for distraction-free viewing',
    category: 'zen',
    default: { key: 'Shift', sequence: ['Z', 'E', 'N'] },
  }),

  exitZen: defineShortcut({
    id: 'exitZen',
    label: 'Exit Zen Mode',
    description: 'Return from zen mode to normal view',
    category: 'zen',
    default: { key: 'Escape' },
  }),

  // ============================================
  // FLIGHT CONTROLS - MOVEMENT
  // ============================================
  moveForward: defineShortcut({
    id: 'moveForward',
    label: 'Fly Forward',
    description: 'Move camera forward',
    category: 'flight',
    default: { key: 'w' },
  }),

  moveBackward: defineShortcut({
    id: 'moveBackward',
    label: 'Fly Backward',
    description: 'Move camera backward',
    category: 'flight',
    default: { key: 's' },
  }),

  moveLeft: defineShortcut({
    id: 'moveLeft',
    label: 'Strafe Left',
    description: 'Move camera left',
    category: 'flight',
    default: { key: 'a' },
  }),

  moveRight: defineShortcut({
    id: 'moveRight',
    label: 'Strafe Right',
    description: 'Move camera right',
    category: 'flight',
    default: { key: 'd' },
  }),

  moveUp: defineShortcut({
    id: 'moveUp',
    label: 'Fly Up',
    description: 'Move camera upward',
    category: 'flight',
    default: { key: 'e' },
  }),

  moveDown: defineShortcut({
    id: 'moveDown',
    label: 'Fly Down',
    description: 'Move camera downward',
    category: 'flight',
    default: { key: 'q' },
  }),

  // ============================================
  // FLIGHT CONTROLS - CAMERA
  // ============================================
  rollLeft: defineShortcut({
    id: 'rollLeft',
    label: 'Roll Left',
    description: 'Rotate camera counterclockwise',
    category: 'flight',
    default: { key: 'a', modifiers: { shift: true } },
  }),

  rollRight: defineShortcut({
    id: 'rollRight',
    label: 'Roll Right',
    description: 'Rotate camera clockwise',
    category: 'flight',
    default: { key: 'd', modifiers: { shift: true } },
  }),

  resetCamera: defineShortcut({
    id: 'resetCamera',
    label: 'Reset Camera',
    description: 'Reset camera to default position',
    category: 'flight',
    default: { key: 'r' },
  }),

  orbReposition: defineShortcut({
    id: 'orbReposition',
    label: 'Reposition Orb',
    description: 'Hold to reposition camera orbit point in 3rd person',
    category: 'flight',
    default: { key: '/' },
  }),

  // ============================================
  // CRUISE CONTROL
  // ============================================
  toggleCruise: defineShortcut({
    id: 'toggleCruise',
    label: 'Toggle Cruise',
    description: 'Enable/disable auto-forward flight',
    category: 'cruise',
    default: { key: 'Shift', sequence: ['F', 'L', 'Y'] },
  }),
};

// Get all shortcuts as an array for iteration
export function getShortcutsArray(): ShortcutDefinition[] {
  return Object.values(DEFAULT_SHORTCUTS);
}

// Get shortcuts grouped by category
export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const grouped: Record<string, ShortcutDefinition[]> = {};

  for (const shortcut of Object.values(DEFAULT_SHORTCUTS)) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  }

  return grouped;
}
