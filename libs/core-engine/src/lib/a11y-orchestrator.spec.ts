import { describe, it, expect, vi } from 'vitest';
import { A11yOrchestrator } from './a11y-orchestrator.js';
import type { CDPSessionLike } from './types.js';

/**
 * Create a comprehensive mock CDP session that routes protocol calls
 * to the correct sub-engine response.
 *
 * Simulates AXTree responses (speech), keyboard dispatch, Runtime.evaluate
 * for focused element + focus styles + tab order + trap detection.
 */
function createMockCDP(options: {
  /** AXTree nodes to return from Accessibility.getFullAXTree. */
  axNodes?: Array<Record<string, unknown>>;
  /** Focused element info returned by Runtime.evaluate (getFocusedElement). */
  focusedElement?: Record<string, unknown> | null;
  /** Focus styles returned by Runtime.evaluate (getFocusIndicator). */
  focusStyles?: Record<string, string> | null;
  /** Tab order entries returned by Runtime.evaluate (getTabOrder). */
  tabOrder?: Array<Record<string, unknown>>;
  /** Trap detection config. */
  trapDetection?: {
    focusResult?: { success?: boolean; error?: string };
    checks?: Array<{ outside: boolean; element: Record<string, unknown> | null }>;
  };
} = {}): CDPSessionLike & { send: ReturnType<typeof vi.fn> } {
  let trapCheckIndex = 0;

  return {
    send: vi.fn().mockImplementation((method: string, params?: Record<string, unknown>) => {
      // Accessibility domain
      if (method === 'Accessibility.enable' || method === 'Accessibility.disable') {
        return Promise.resolve();
      }

      if (method === 'Accessibility.getFullAXTree') {
        return Promise.resolve({
          nodes: options.axNodes ?? [],
        });
      }

      // Key dispatch
      if (method === 'Input.dispatchKeyEvent') {
        return Promise.resolve();
      }

      // Runtime.evaluate — route by expression content
      if (method === 'Runtime.evaluate') {
        const expr = (params?.expression as string) || '';

        // Tab order query (check before getComputedStyle since tab order also uses it)
        if (expr.includes('querySelectorAll') && expr.includes('tabindex')) {
          return Promise.resolve({
            result: { value: options.tabOrder ?? [] },
          });
        }

        // Trap detection — initial focus (check before general activeElement matches)
        if (expr.includes('focusable.focus()')) {
          return Promise.resolve({
            result: {
              value: options.trapDetection?.focusResult ?? { success: true },
            },
          });
        }

        // Trap detection — check position (check before general activeElement matches)
        if (expr.includes('container.contains')) {
          const checks = options.trapDetection?.checks ?? [];
          const check = checks[trapCheckIndex] ?? { outside: true, element: null };
          trapCheckIndex++;
          return Promise.resolve({
            result: { value: check },
          });
        }

        // Focus styles query (getFocusIndicator)
        if (expr.includes('getComputedStyle') && expr.includes('activeElement')) {
          return Promise.resolve({
            result: { value: options.focusStyles ?? null },
          });
        }

        // Focused element query (getFocusedElement from KeyboardEngine)
        // Uses aria-label as unique marker (not in trap detection expressions)
        if (expr.includes('activeElement') && expr.includes('aria-label')) {
          return Promise.resolve({
            result: { value: options.focusedElement ?? null },
          });
        }

        return Promise.resolve({ result: { value: null } });
      }

      return Promise.resolve();
    }),
  };
}

/**
 * Create a focused button AXNode for test scenarios.
 */
function focusedButtonNode(name: string, extraProps: Array<Record<string, unknown>> = []) {
  return {
    nodeId: '2',
    role: { type: 'role', value: 'button' },
    name: { type: 'computedString', value: name },
    properties: [
      { name: 'focused', value: { type: 'boolean', value: true } },
      ...extraProps,
    ],
  };
}

describe('A11yOrchestrator', () => {
  describe('enable() / disable()', () => {
    it('calls Accessibility.enable and disable', async () => {
      const cdp = createMockCDP();
      const orchestrator = new A11yOrchestrator(cdp);

      await orchestrator.enable();
      expect(cdp.send).toHaveBeenCalledWith('Accessibility.enable');

      await orchestrator.disable();
      expect(cdp.send).toHaveBeenCalledWith('Accessibility.disable');
    });
  });

  describe('pressKey()', () => {
    it('dispatches key and returns unified state', async () => {
      const cdp = createMockCDP({
        axNodes: [focusedButtonNode('Products')],
        focusedElement: {
          tag: 'BUTTON',
          id: 'products-btn',
          className: 'nav-btn',
          textContent: 'Products',
          role: 'button',
          ariaLabel: '',
          tabIndex: 0,
          rect: { x: 100, y: 50, width: 120, height: 40 },
        },
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

      const orchestrator = new A11yOrchestrator(cdp, { focusSettleMs: 0 });
      await orchestrator.enable();

      const state = await orchestrator.pressKey('Tab');

      // Verify key was dispatched (keyDown + keyUp)
      expect(cdp.send).toHaveBeenCalledWith(
        'Input.dispatchKeyEvent',
        expect.objectContaining({ type: 'keyDown' })
      );
      expect(cdp.send).toHaveBeenCalledWith(
        'Input.dispatchKeyEvent',
        expect.objectContaining({ type: 'keyUp' })
      );

      // Verify unified state
      expect(state.speech).toBe('Products, button');
      expect(state.speechResult).not.toBeNull();
      expect(state.speechResult?.name).toBe('Products');
      expect(state.speechResult?.role).toBe('button');

      expect(state.focusedElement).not.toBeNull();
      expect(state.focusedElement?.tag).toBe('BUTTON');
      expect(state.focusedElement?.id).toBe('products-btn');
      expect(state.focusedElement?.textContent).toBe('Products');

      expect(state.focusIndicator.isVisible).toBe(true);
      expect(state.focusIndicator.contrastRatio).not.toBeNull();
    });

    it('dispatches key with modifiers', async () => {
      const cdp = createMockCDP({
        axNodes: [],
        focusedElement: null,
        focusStyles: null,
      });

      const orchestrator = new A11yOrchestrator(cdp, { focusSettleMs: 0 });
      const state = await orchestrator.pressKey('Tab', { shift: true });

      // Verify Shift+Tab was dispatched (modifiers = 8 for Shift)
      expect(cdp.send).toHaveBeenCalledWith(
        'Input.dispatchKeyEvent',
        expect.objectContaining({
          type: 'keyDown',
          modifiers: 8,
        })
      );

      expect(state.speech).toBe('');
      expect(state.focusedElement).toBeNull();
    });

    it('includes states in speech output', async () => {
      const cdp = createMockCDP({
        axNodes: [
          focusedButtonNode('Products', [
            { name: 'expanded', value: { type: 'boolean', value: false } },
          ]),
        ],
        focusedElement: {
          tag: 'BUTTON',
          id: '',
          className: '',
          textContent: 'Products',
          role: '',
          ariaLabel: '',
          tabIndex: 0,
          rect: { x: 0, y: 0, width: 0, height: 0 },
        },
        focusStyles: null,
      });

      const orchestrator = new A11yOrchestrator(cdp, { focusSettleMs: 0 });
      await orchestrator.enable();
      const state = await orchestrator.pressKey('Tab');

      expect(state.speech).toBe('Products, button, collapsed');
    });
  });

  describe('getState()', () => {
    it('returns current state without pressing a key', async () => {
      const cdp = createMockCDP({
        axNodes: [focusedButtonNode('Home')],
        focusedElement: {
          tag: 'A',
          id: 'home-link',
          className: 'nav-link',
          textContent: 'Home',
          role: 'link',
          ariaLabel: 'Home page',
          tabIndex: 0,
          rect: { x: 0, y: 0, width: 60, height: 30 },
        },
        focusStyles: {
          outline: '2px solid rgb(255, 255, 255)',
          outlineColor: 'rgb(255, 255, 255)',
          outlineWidth: '2px',
          outlineOffset: '0px',
          boxShadow: 'none',
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(0, 0, 0)',
        },
      });

      const orchestrator = new A11yOrchestrator(cdp);
      await orchestrator.enable();
      const state = await orchestrator.getState();

      // No key dispatch should have occurred
      expect(cdp.send).not.toHaveBeenCalledWith(
        'Input.dispatchKeyEvent',
        expect.anything()
      );

      expect(state.speech).toBe('Home, button');
      expect(state.focusedElement?.tag).toBe('A');
      expect(state.focusedElement?.ariaLabel).toBe('Home page');
      expect(state.focusIndicator.isVisible).toBe(true);
      expect(state.focusIndicator.meetsWCAG_AA).toBe(true);
    });

    it('returns empty state when nothing is focused', async () => {
      const cdp = createMockCDP({
        axNodes: [],
        focusedElement: null,
        focusStyles: null,
      });

      const orchestrator = new A11yOrchestrator(cdp);
      const state = await orchestrator.getState();

      expect(state.speech).toBe('');
      expect(state.speechResult).toBeNull();
      expect(state.focusedElement).toBeNull();
      expect(state.focusIndicator.isVisible).toBe(false);
      expect(state.focusIndicator.contrastRatio).toBeNull();
      expect(state.focusIndicator.meetsWCAG_AA).toBe(false);
    });
  });

  describe('traverseTabOrder()', () => {
    it('returns tab order report', async () => {
      const mockEntries = [
        { index: 0, tag: 'A', id: 'home', textContent: 'Home', tabIndex: 0, role: 'menuitem', rect: { x: 0, y: 0, width: 80, height: 30 } },
        { index: 1, tag: 'BUTTON', id: 'products', textContent: 'Products', tabIndex: 0, role: 'menuitem', rect: { x: 80, y: 0, width: 100, height: 30 } },
        { index: 2, tag: 'INPUT', id: 'search', textContent: '', tabIndex: 0, role: '', rect: { x: 200, y: 0, width: 200, height: 30 } },
      ];

      const cdp = createMockCDP({ tabOrder: mockEntries });
      const orchestrator = new A11yOrchestrator(cdp);
      const report = await orchestrator.traverseTabOrder();

      expect(report.totalCount).toBe(3);
      expect(report.entries).toHaveLength(3);
      expect(report.entries[0].tag).toBe('A');
      expect(report.entries[2].tag).toBe('INPUT');
    });

    it('returns empty report when no tabbable elements', async () => {
      const cdp = createMockCDP({ tabOrder: [] });
      const orchestrator = new A11yOrchestrator(cdp);
      const report = await orchestrator.traverseTabOrder();

      expect(report.totalCount).toBe(0);
      expect(report.entries).toEqual([]);
    });
  });

  describe('traverseSubTree()', () => {
    it('detects a keyboard trap', async () => {
      const cdp = createMockCDP({
        trapDetection: {
          focusResult: { success: true },
          checks: Array.from({ length: 5 }, (_, i) => ({
            outside: false,
            element: {
              index: i,
              tag: 'BUTTON',
              id: `btn-${i}`,
              textContent: `Button ${i}`,
              tabIndex: 0,
              role: '',
              rect: { x: 0, y: 0, width: 100, height: 30 },
            },
          })),
        },
      });

      const orchestrator = new A11yOrchestrator(cdp);
      const result = await orchestrator.traverseSubTree('#trap', 5);

      expect(result.isTrapped).toBe(true);
      expect(result.tabCount).toBe(5);
      expect(result.visitedElements).toHaveLength(5);
      expect(result.escapeElement).toBeNull();
    });

    it('detects escape from container', async () => {
      const cdp = createMockCDP({
        trapDetection: {
          focusResult: { success: true },
          checks: [
            { outside: false, element: { index: 0, tag: 'INPUT', id: 'name', textContent: '', tabIndex: 0, role: '', rect: { x: 0, y: 0, width: 200, height: 30 } } },
            { outside: true, element: { index: 1, tag: 'BUTTON', id: 'outside', textContent: 'Submit', tabIndex: 0, role: 'button', rect: { x: 0, y: 100, width: 100, height: 30 } } },
          ],
        },
      });

      const orchestrator = new A11yOrchestrator(cdp);
      const result = await orchestrator.traverseSubTree('#form');

      expect(result.isTrapped).toBe(false);
      expect(result.escapeElement?.id).toBe('outside');
    });
  });

  describe('options', () => {
    it('respects focusSettleMs option', async () => {
      const cdp = createMockCDP({
        axNodes: [],
        focusedElement: null,
        focusStyles: null,
      });

      const start = Date.now();
      const orchestrator = new A11yOrchestrator(cdp, { focusSettleMs: 100 });
      await orchestrator.pressKey('Tab');
      const elapsed = Date.now() - start;

      // Should have waited at least ~100ms (allow some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(80);
    });

    it('skips settle delay when focusSettleMs is 0', async () => {
      const cdp = createMockCDP({
        axNodes: [],
        focusedElement: null,
        focusStyles: null,
      });

      const start = Date.now();
      const orchestrator = new A11yOrchestrator(cdp, { focusSettleMs: 0 });
      await orchestrator.pressKey('Tab');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});
