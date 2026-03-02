/**
 * @module @a11y-oracle/keyboard-engine
 *
 * CDP-based keyboard dispatch engine for accessibility testing.
 * Provides native hardware-level keystroke dispatch and focused
 * element introspection.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
 *
 * const keyboard = new KeyboardEngine(cdpSession);
 * await keyboard.press('Tab');
 * await keyboard.press('Tab', { shift: true }); // Shift+Tab
 *
 * const el = await keyboard.getFocusedElement();
 * console.log(el?.tag, el?.id, el?.role);
 * ```
 *
 * @packageDocumentation
 */

export { KeyboardEngine } from './lib/keyboard-engine.js';
export { KEY_DEFINITIONS } from './lib/key-map.js';
export type {
  CDPSessionLike,
  KeyDefinition,
  ModifierKeys,
  FocusedElementInfo,
} from './lib/types.js';
