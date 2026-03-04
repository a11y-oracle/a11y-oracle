/**
 * @module keyboard-engine
 *
 * CDP-based keyboard dispatch engine. Sends native hardware-level
 * keystrokes via `Input.dispatchKeyEvent` and reads focused element
 * information via `Runtime.evaluate`.
 *
 * @example
 * ```typescript
 * import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
 *
 * const keyboard = new KeyboardEngine(cdpSession);
 * await keyboard.press('Tab');
 * const focused = await keyboard.getFocusedElement();
 * console.log(focused?.tag, focused?.id);
 * ```
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { ModifierKeys, FocusedElementInfo } from './types.js';
import { KEY_DEFINITIONS } from './key-map.js';

/**
 * Compute the CDP modifier bitmask from a {@link ModifierKeys} object.
 *
 * Bitmask values per CDP spec:
 * - Alt = 1
 * - Ctrl = 2
 * - Meta = 4
 * - Shift = 8
 */
function computeModifiers(modifiers?: ModifierKeys): number {
  if (!modifiers) return 0;
  let bitmask = 0;
  if (modifiers.alt) bitmask |= 1;
  if (modifiers.ctrl) bitmask |= 2;
  if (modifiers.meta) bitmask |= 4;
  if (modifiers.shift) bitmask |= 8;
  return bitmask;
}

/**
 * JavaScript expression evaluated in the browser to extract
 * focused element information from `document.activeElement`.
 *
 * Returns `null` if no element has focus or the body is focused.
 */
const GET_FOCUSED_ELEMENT_JS = `
(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    id: el.id || '',
    className: typeof el.className === 'string' ? el.className : '',
    textContent: (el.textContent || '').trim().substring(0, 200),
    role: el.getAttribute('role') || '',
    ariaLabel: el.getAttribute('aria-label') || '',
    tabIndex: el.tabIndex,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
})()
`;

/**
 * Engine for dispatching native keyboard events via Chrome DevTools Protocol.
 *
 * Uses `Input.dispatchKeyEvent` for hardware-level key dispatch (bypassing
 * synthetic JavaScript events) and `Runtime.evaluate` for reading
 * `document.activeElement` properties.
 */
export class KeyboardEngine {
  /**
   * Create a new KeyboardEngine.
   *
   * @param cdp - CDP session to send commands through.
   */
  constructor(private cdp: CDPSessionLike) {}

  /**
   * Press a keyboard key via CDP `Input.dispatchKeyEvent`.
   *
   * Dispatches a `keyDown` event followed by a `keyUp` event, matching
   * the behavior of a physical key press.
   *
   * @param key - Key name from {@link KEY_DEFINITIONS}
   *   (e.g. `'Tab'`, `'Enter'`, `'ArrowDown'`).
   * @param modifiers - Optional modifier keys to hold during the press.
   *
   * @throws Error if the key is not in {@link KEY_DEFINITIONS}.
   *
   * @example
   * ```typescript
   * await keyboard.press('Tab');
   * await keyboard.press('Tab', { shift: true }); // Shift+Tab
   * ```
   */
  async press(key: string, modifiers?: ModifierKeys): Promise<void> {
    const keyDef = KEY_DEFINITIONS[key];
    if (!keyDef) {
      const supported = Object.keys(KEY_DEFINITIONS).join(', ');
      throw new Error(
        `Unknown key: "${key}". Supported keys: ${supported}`
      );
    }

    const mod = computeModifiers(modifiers);

    await this.cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: keyDef.key,
      code: keyDef.code,
      windowsVirtualKeyCode: keyDef.keyCode,
      nativeVirtualKeyCode: keyDef.keyCode,
      modifiers: mod,
    });

    await this.cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: keyDef.key,
      code: keyDef.code,
      windowsVirtualKeyCode: keyDef.keyCode,
      nativeVirtualKeyCode: keyDef.keyCode,
      modifiers: mod,
    });
  }

  /**
   * Get information about the currently focused DOM element.
   *
   * Uses `Runtime.evaluate` to query `document.activeElement` and
   * extract its properties.
   *
   * @returns The focused element info, or `null` if no interactive
   *          element has focus (e.g. body or document is focused).
   *
   * @example
   * ```typescript
   * await keyboard.press('Tab');
   * const el = await keyboard.getFocusedElement();
   * console.log(el?.tag); // 'BUTTON'
   * console.log(el?.id);  // 'submit-btn'
   * ```
   */
  async getFocusedElement(): Promise<FocusedElementInfo | null> {
    const result = (await this.cdp.send('Runtime.evaluate', {
      expression: GET_FOCUSED_ELEMENT_JS,
      returnByValue: true,
    })) as { result: { value: FocusedElementInfo | null } };

    return result.result.value ?? null;
  }
}
