import { describe, it, expect, vi } from 'vitest';
import { FocusAnalyzer } from './focus-analyzer.js';
import type { CDPSessionLike } from '@a11y-oracle/keyboard-engine';

/**
 * Create a mock CDP session for FocusAnalyzer testing.
 *
 * Provides configurable responses for `Runtime.evaluate` calls
 * based on the expression content.
 */
function createMockCDP(options: {
  focusStyles?: Record<string, string> | null;
  tabOrder?: Array<Record<string, unknown>>;
  trapDetection?: {
    focusResult?: { success?: boolean; error?: string };
    checks?: Array<{ outside: boolean; element: Record<string, unknown> | null }>;
  };
} = {}): CDPSessionLike & { send: ReturnType<typeof vi.fn> } {
  let trapCheckIndex = 0;

  return {
    send: vi.fn().mockImplementation((method: string, params?: Record<string, unknown>) => {
      if (method === 'Input.dispatchKeyEvent') {
        return Promise.resolve();
      }

      if (method === 'Runtime.evaluate') {
        const expr = (params?.expression as string) || '';

        // Tab order query (must be checked before focus styles because
        // the tab order expression also contains getComputedStyle for
        // visibility filtering)
        if (expr.includes('querySelectorAll') && expr.includes('tabindex')) {
          return Promise.resolve({
            result: { value: options.tabOrder ?? [] },
          });
        }

        // Focus styles query
        if (expr.includes('getComputedStyle')) {
          return Promise.resolve({
            result: { value: options.focusStyles ?? null },
          });
        }

        // Trap detection - initial focus
        if (expr.includes('focusable.focus()')) {
          return Promise.resolve({
            result: {
              value: options.trapDetection?.focusResult ?? { success: true },
            },
          });
        }

        // Trap detection - check position
        if (expr.includes('container.contains(el)')) {
          const checks = options.trapDetection?.checks ?? [];
          const check = checks[trapCheckIndex] ?? { outside: true, element: null };
          trapCheckIndex++;
          return Promise.resolve({
            result: { value: check },
          });
        }

        return Promise.resolve({ result: { value: null } });
      }

      return Promise.resolve();
    }),
  };
}

describe('FocusAnalyzer', () => {
  describe('getFocusIndicator()', () => {
    it('returns visible indicator with outline', async () => {
      const cdp = createMockCDP({
        focusStyles: {
          outline: '3px solid rgb(52, 152, 219)',
          outlineColor: 'rgb(52, 152, 219)',
          outlineWidth: '3px',
          outlineOffset: '2px',
          boxShadow: 'none',
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(44, 62, 80)',
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const indicator = await analyzer.getFocusIndicator();

      expect(indicator.isVisible).toBe(true);
      expect(indicator.outlineColor).toBe('rgb(52, 152, 219)');
      expect(indicator.outlineWidth).toBe('3px');
      expect(indicator.contrastRatio).not.toBeNull();
      expect(indicator.contrastRatio!).toBeGreaterThan(1);
    });

    it('returns visible indicator with box-shadow', async () => {
      const cdp = createMockCDP({
        focusStyles: {
          outline: 'none',
          outlineColor: 'transparent',
          outlineWidth: '0px',
          outlineOffset: '0px',
          boxShadow: '0px 0px 0px 3px rgb(52, 152, 219)',
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const indicator = await analyzer.getFocusIndicator();

      expect(indicator.isVisible).toBe(true);
      expect(indicator.boxShadow).toContain('rgb(52, 152, 219)');
    });

    it('returns not visible when outline is 0px and no box-shadow', async () => {
      const cdp = createMockCDP({
        focusStyles: {
          outline: 'none',
          outlineColor: 'rgb(0, 0, 0)',
          outlineWidth: '0px',
          outlineOffset: '0px',
          boxShadow: 'none',
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const indicator = await analyzer.getFocusIndicator();

      expect(indicator.isVisible).toBe(false);
      expect(indicator.meetsWCAG_AA).toBe(false);
    });

    it('returns not visible when outline color is transparent', async () => {
      const cdp = createMockCDP({
        focusStyles: {
          outline: '3px solid transparent',
          outlineColor: 'transparent',
          outlineWidth: '3px',
          outlineOffset: '0px',
          boxShadow: 'none',
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const indicator = await analyzer.getFocusIndicator();

      expect(indicator.isVisible).toBe(false);
    });

    it('returns empty indicator when no element has focus', async () => {
      const cdp = createMockCDP({ focusStyles: null });

      const analyzer = new FocusAnalyzer(cdp);
      const indicator = await analyzer.getFocusIndicator();

      expect(indicator.isVisible).toBe(false);
      expect(indicator.contrastRatio).toBeNull();
      expect(indicator.meetsWCAG_AA).toBe(false);
      expect(indicator.outline).toBe('');
    });

    it('sets meetsWCAG_AA to true when contrast >= 3.0', async () => {
      // White outline on black background = 21:1 contrast
      const cdp = createMockCDP({
        focusStyles: {
          outline: '3px solid rgb(255, 255, 255)',
          outlineColor: 'rgb(255, 255, 255)',
          outlineWidth: '3px',
          outlineOffset: '0px',
          boxShadow: 'none',
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(0, 0, 0)',
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const indicator = await analyzer.getFocusIndicator();

      expect(indicator.isVisible).toBe(true);
      expect(indicator.contrastRatio).toBeCloseTo(21, 0);
      expect(indicator.meetsWCAG_AA).toBe(true);
    });
  });

  describe('getTabOrder()', () => {
    it('returns tab order entries', async () => {
      const mockEntries = [
        { index: 0, tag: 'A', id: 'home', textContent: 'Home', tabIndex: 0, role: 'menuitem', rect: { x: 0, y: 0, width: 80, height: 30 } },
        { index: 1, tag: 'BUTTON', id: 'products', textContent: 'Products', tabIndex: 0, role: 'menuitem', rect: { x: 80, y: 0, width: 100, height: 30 } },
      ];

      const cdp = createMockCDP({ tabOrder: mockEntries });
      const analyzer = new FocusAnalyzer(cdp);
      const entries = await analyzer.getTabOrder();

      expect(entries).toHaveLength(2);
      expect(entries[0].tag).toBe('A');
      expect(entries[0].id).toBe('home');
      expect(entries[1].tag).toBe('BUTTON');
    });

    it('returns empty array when no tabbable elements', async () => {
      const cdp = createMockCDP({ tabOrder: [] });
      const analyzer = new FocusAnalyzer(cdp);
      const entries = await analyzer.getTabOrder();

      expect(entries).toEqual([]);
    });
  });

  describe('detectKeyboardTrap()', () => {
    it('detects a keyboard trap when focus never escapes', async () => {
      const cdp = createMockCDP({
        trapDetection: {
          focusResult: { success: true },
          checks: Array.from({ length: 50 }, (_, i) => ({
            outside: false,
            element: {
              index: i,
              tag: 'BUTTON',
              id: `btn-${i % 3}`,
              textContent: `Button ${i % 3}`,
              tabIndex: 0,
              role: '',
              rect: { x: 0, y: 0, width: 100, height: 30 },
            },
          })),
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const result = await analyzer.detectKeyboardTrap('#bad-trap', 5);

      expect(result.isTrapped).toBe(true);
      expect(result.tabCount).toBe(5);
      expect(result.visitedElements.length).toBe(5);
      expect(result.escapeElement).toBeNull();
    });

    it('detects escape when focus leaves the container', async () => {
      const cdp = createMockCDP({
        trapDetection: {
          focusResult: { success: true },
          checks: [
            { outside: false, element: { index: 0, tag: 'INPUT', id: 'name', textContent: '', tabIndex: 0, role: '', rect: { x: 0, y: 0, width: 200, height: 30 } } },
            { outside: false, element: { index: 1, tag: 'INPUT', id: 'email', textContent: '', tabIndex: 0, role: '', rect: { x: 0, y: 30, width: 200, height: 30 } } },
            { outside: true, element: { index: 2, tag: 'BUTTON', id: 'outside-btn', textContent: 'Submit', tabIndex: 0, role: 'button', rect: { x: 0, y: 100, width: 100, height: 30 } } },
          ],
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const result = await analyzer.detectKeyboardTrap('#good-container');

      expect(result.isTrapped).toBe(false);
      expect(result.tabCount).toBe(3);
      expect(result.visitedElements).toHaveLength(2);
      expect(result.escapeElement).not.toBeNull();
      expect(result.escapeElement!.id).toBe('outside-btn');
    });

    it('returns not trapped when container is not found', async () => {
      const cdp = createMockCDP({
        trapDetection: {
          focusResult: { error: 'Container not found' },
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const result = await analyzer.detectKeyboardTrap('#nonexistent');

      expect(result.isTrapped).toBe(false);
      expect(result.tabCount).toBe(0);
    });

    it('returns not trapped when no focusable elements in container', async () => {
      const cdp = createMockCDP({
        trapDetection: {
          focusResult: { error: 'No focusable elements in container' },
        },
      });

      const analyzer = new FocusAnalyzer(cdp);
      const result = await analyzer.detectKeyboardTrap('#empty-container');

      expect(result.isTrapped).toBe(false);
      expect(result.tabCount).toBe(0);
    });
  });
});
