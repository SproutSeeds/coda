/**
 * Keyboard Shortcut System - Type Definitions
 *
 * All customizable shortcuts in the application are defined here.
 * Each shortcut has a unique ID, display info, and binding configuration.
 */

// All available shortcut identifiers
export type ShortcutId =
  // Global UI Shortcuts
  | 'dismiss'           // ESC - Close panels, cancel actions
  | 'submit'            // ENTER - Submit forms
  | 'newline'           // SHIFT+ENTER - Insert newline
  // Animation Control
  | 'freeze'            // SHIFT+SPACE - Toggle freeze mode
  // Zen Mode
  | 'zenMode'           // SHIFT+Z+E+N sequence - Enter zen mode
  | 'exitZen'           // ESC (in zen mode) - Exit zen mode
  // Flight Controls - Movement
  | 'moveForward'       // W - Fly forward
  | 'moveBackward'      // S - Fly backward
  | 'moveLeft'          // A - Strafe left
  | 'moveRight'         // D - Strafe right
  | 'moveUp'            // E - Fly up
  | 'moveDown'          // Q - Fly down
  // Flight Controls - Camera
  | 'rollLeft'          // SHIFT+A - Roll camera left
  | 'rollRight'         // SHIFT+D - Roll camera right
  | 'resetCamera'       // R or HOME - Reset camera position
  | 'orbReposition'     // / - Hold to reposition orbit point in 3rd person
  // Cruise Control
  | 'toggleCruise';     // SHIFT+F+L+Y sequence - Toggle cruise mode

// Categories for organizing shortcuts in UI
export type ShortcutCategory = 'ui' | 'animation' | 'flight' | 'cruise' | 'zen';

// A key binding configuration
export interface ShortcutBinding {
  /** The main key (e.g., 'w', 'Escape', ' ' for space) */
  key: string;
  /** Modifier keys required */
  modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  /** For sequence shortcuts like Shift+Z+E+N (array of keys to type while holding shift) */
  sequence?: string[];
}

// Full shortcut definition with metadata
export interface ShortcutDefinition {
  /** Unique identifier */
  id: ShortcutId;
  /** Display label (e.g., "Move Forward") */
  label: string;
  /** Description for UI (e.g., "Fly the camera forward") */
  description: string;
  /** Category for grouping in settings */
  category: ShortcutCategory;
  /** Default binding (used for reset) */
  default: ShortcutBinding;
  /** Current active binding (user may have customized) */
  current: ShortcutBinding;
}

// The complete shortcuts state
export type ShortcutRegistry = Record<ShortcutId, ShortcutDefinition>;

// Helper type for category labels
export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  ui: 'Interface',
  animation: 'Animation',
  flight: 'Flight Controls',
  cruise: 'Cruise Control',
  zen: 'Zen Mode',
};
