import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyboardEngine } from './keyboard-engine.js';
import type { CDPSessionLike } from './types.js';

/**
 * Create a mock CDP session that records all `send()` calls.
 *
 * By default, `Runtime.evaluate` returns `null` (no focused element).
 * Pass a `focusedElement` value to override.
 */
function createMockCDP(
  focusedElement: Record<string, unknown> | null = null
): CDPSessionLike & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn().mockImplementation((method: string) => {
      if (method === 'Input.dispatchKeyEvent') {
        return Promise.resolve();
      }
      if (method === 'Runtime.evaluate') {
        return Promise.resolve({
          result: { value: focusedElement },
        });
      }
      return Promise.resolve();
    }),
  };
}

describe('KeyboardEngine', () => {
  describe('press()', () => {
    it('dispatches keyDown and keyUp for Tab', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Tab');

      expect(cdp.send).toHaveBeenCalledTimes(2);

      // keyDown
      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
        modifiers: 0,
      });

      // keyUp
      expect(cdp.send).toHaveBeenNthCalledWith(2, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
        modifiers: 0,
      });
    });

    it('dispatches correct parameters for Enter', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Enter');

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        modifiers: 0,
      });
    });

    it('dispatches correct parameters for ArrowDown', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('ArrowDown');

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'ArrowDown',
        code: 'ArrowDown',
        windowsVirtualKeyCode: 40,
        nativeVirtualKeyCode: 40,
        modifiers: 0,
      });
    });

    it('dispatches Space key with correct code', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Space');

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: ' ',
        code: 'Space',
        windowsVirtualKeyCode: 32,
        nativeVirtualKeyCode: 32,
        modifiers: 0,
      });
    });

    it('includes Shift modifier (bitmask 8) for Shift+Tab', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Tab', { shift: true });

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
        modifiers: 8,
      });

      expect(cdp.send).toHaveBeenNthCalledWith(2, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
        modifiers: 8,
      });
    });

    it('includes Ctrl modifier (bitmask 2)', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Enter', { ctrl: true });

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent',
        expect.objectContaining({ modifiers: 2 })
      );
    });

    it('includes Alt modifier (bitmask 1)', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Tab', { alt: true });

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent',
        expect.objectContaining({ modifiers: 1 })
      );
    });

    it('includes Meta modifier (bitmask 4)', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Tab', { meta: true });

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent',
        expect.objectContaining({ modifiers: 4 })
      );
    });

    it('combines multiple modifiers (Ctrl+Shift = 10)', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Tab', { ctrl: true, shift: true });

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent',
        expect.objectContaining({ modifiers: 10 })
      );
    });

    it('combines all modifiers (Alt+Ctrl+Meta+Shift = 15)', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.press('Tab', { alt: true, ctrl: true, meta: true, shift: true });

      expect(cdp.send).toHaveBeenNthCalledWith(1, 'Input.dispatchKeyEvent',
        expect.objectContaining({ modifiers: 15 })
      );
    });

    it('throws descriptive error for unknown key', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await expect(keyboard.press('F13')).rejects.toThrow(
        'Unknown key: "F13". Supported keys:'
      );
    });

    it('error message lists all supported keys', async () => {
      const cdp = createMockCDP();
      const keyboard = new KeyboardEngine(cdp);

      await expect(keyboard.press('Unknown')).rejects.toThrow('Tab');
      await expect(keyboard.press('Unknown')).rejects.toThrow('Enter');
      await expect(keyboard.press('Unknown')).rejects.toThrow('ArrowDown');
    });
  });

  describe('getFocusedElement()', () => {
    it('returns element info when an element has focus', async () => {
      const mockElement = {
        tag: 'BUTTON',
        id: 'submit-btn',
        className: 'btn primary',
        textContent: 'Submit',
        role: 'button',
        ariaLabel: 'Submit form',
        tabIndex: 0,
        rect: { x: 100, y: 200, width: 120, height: 40 },
      };

      const cdp = createMockCDP(mockElement);
      const keyboard = new KeyboardEngine(cdp);

      const result = await keyboard.getFocusedElement();

      expect(result).toEqual(mockElement);
      expect(result!.tag).toBe('BUTTON');
      expect(result!.id).toBe('submit-btn');
      expect(result!.role).toBe('button');
      expect(result!.ariaLabel).toBe('Submit form');
      expect(result!.tabIndex).toBe(0);
      expect(result!.rect).toEqual({ x: 100, y: 200, width: 120, height: 40 });
    });

    it('returns null when body is focused (no interactive element)', async () => {
      const cdp = createMockCDP(null);
      const keyboard = new KeyboardEngine(cdp);

      const result = await keyboard.getFocusedElement();

      expect(result).toBeNull();
    });

    it('calls Runtime.evaluate with returnByValue', async () => {
      const cdp = createMockCDP(null);
      const keyboard = new KeyboardEngine(cdp);

      await keyboard.getFocusedElement();

      expect(cdp.send).toHaveBeenCalledWith(
        'Runtime.evaluate',
        expect.objectContaining({
          returnByValue: true,
        })
      );
    });

    it('returns link element info', async () => {
      const mockLink = {
        tag: 'A',
        id: 'home-link',
        className: 'nav-item',
        textContent: 'Home',
        role: 'menuitem',
        ariaLabel: '',
        tabIndex: 0,
        rect: { x: 10, y: 50, width: 80, height: 30 },
      };

      const cdp = createMockCDP(mockLink);
      const keyboard = new KeyboardEngine(cdp);

      const result = await keyboard.getFocusedElement();

      expect(result).toEqual(mockLink);
      expect(result!.tag).toBe('A');
      expect(result!.role).toBe('menuitem');
    });

    it('returns input element info', async () => {
      const mockInput = {
        tag: 'INPUT',
        id: 'email-field',
        className: 'form-input',
        textContent: '',
        role: '',
        ariaLabel: 'Email address',
        tabIndex: 0,
        rect: { x: 50, y: 100, width: 300, height: 35 },
      };

      const cdp = createMockCDP(mockInput);
      const keyboard = new KeyboardEngine(cdp);

      const result = await keyboard.getFocusedElement();

      expect(result).toEqual(mockInput);
      expect(result!.tag).toBe('INPUT');
      expect(result!.ariaLabel).toBe('Email address');
    });
  });
});
