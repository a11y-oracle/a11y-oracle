/**
 * @module key-map
 *
 * Maps human-readable key names to CDP `Input.dispatchKeyEvent` parameters.
 * Used by the {@link commands} module to dispatch real keyboard events
 * through the Chrome DevTools Protocol.
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
 * Map of key names to their CDP Input.dispatchKeyEvent parameters.
 *
 * Supports all common navigation and interaction keys used in
 * WCAG keyboard accessibility patterns.
 */
export const KEY_DEFINITIONS: Record<string, KeyDefinition> = {
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
  ' ': { key: ' ', code: 'Space', keyCode: 32 },
  Space: { key: ' ', code: 'Space', keyCode: 32 },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  Home: { key: 'Home', code: 'Home', keyCode: 36 },
  End: { key: 'End', code: 'End', keyCode: 35 },
  Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
  Delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
};
