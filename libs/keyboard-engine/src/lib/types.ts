/**
 * @module types
 *
 * Type definitions for the keyboard engine.
 */

/**
 * CDP keyboard event parameter definition for a single key.
 */
export interface KeyDefinition {
  /** The `key` property for CDP (e.g. `'Tab'`, `'Enter'`). */
  key: string;
  /** The `code` property for CDP (e.g. `'Tab'`, `'Enter'`). */
  code: string;
  /** The Windows virtual key code (e.g. `9` for Tab). */
  keyCode: number;
}

/**
 * Modifier keys that can be held during a key press.
 *
 * Maps to CDP's `Input.dispatchKeyEvent` `modifiers` bitmask:
 * - Alt = 1
 * - Ctrl = 2
 * - Meta = 4
 * - Shift = 8
 */
export interface ModifierKeys {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Information about the currently focused DOM element.
 *
 * Obtained via `Runtime.evaluate` querying `document.activeElement`.
 */
export interface FocusedElementInfo {
  /** The tag name (e.g. `'BUTTON'`, `'A'`, `'INPUT'`). */
  tag: string;
  /** The element's `id` attribute, or empty string. */
  id: string;
  /** The element's `className` string. */
  className: string;
  /** Trimmed text content of the element. */
  textContent: string;
  /** The element's `role` attribute, or empty string. */
  role: string;
  /** The element's `aria-label` attribute, or empty string. */
  ariaLabel: string;
  /** The element's `tabIndex` property. */
  tabIndex: number;
  /** The element's bounding rectangle. */
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
