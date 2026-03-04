import { describe, it, expect } from 'vitest';
import { resolveAriaHiddenFocus } from './aria-hidden-focus.js';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, AxeRule } from '../types.js';

function makeNode(selector: string, overrides: Partial<AxeNode> = {}): AxeNode {
  return {
    target: [selector],
    html: `<span class="test">${selector}</span>`,
    any: [],
    all: [],
    none: [],
    impact: 'serious',
    ...overrides,
  };
}

function makeRule(id: string, nodes: AxeNode[]): AxeRule {
  return {
    id,
    impact: 'serious',
    tags: [],
    description: '',
    help: '',
    helpUrl: '',
    nodes,
  };
}

function makeAxeResults(overrides: Partial<AxeResults> = {}): AxeResults {
  return {
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: [],
    ...overrides,
  };
}

/**
 * Build a mock CDP that simulates Tab traversal.
 *
 * The KeyboardEngine sends keyDown then keyUp for each Tab press.
 * The resolver then calls Runtime.evaluate to:
 * 1. Get the focused element selector (expression includes `document.activeElement` and builds path)
 * 2. Check if focused element matches a flagged selector (expression includes `el.matches`)
 *
 * @param tabOrder - Sequence of selectors returned on each successive tab press. null = no focus.
 * @param flaggedSelectors - The selectors of the flagged nodes from axe.
 */
function buildTabTraversalMock(
  tabOrder: (string | null)[],
  flaggedSelectors: string[],
): CDPSessionLike {
  let tabCount = 0;

  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Input.dispatchKeyEvent') {
        // KeyboardEngine sends keyDown then keyUp per Tab press
        if ((params?.type as string) === 'keyDown') {
          tabCount++;
        }
        return {};
      }

      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // blur/focus reset — the resolver does blur + body.focus
        if (expr.includes('blur()') || expr.includes('body.focus')) {
          tabCount = 0;
          return { result: { value: undefined } };
        }

        // Check if focused element matches a flagged selector (el.matches)
        if (expr.includes('el.matches') || expr.includes('.matches(')) {
          const currentFocused =
            tabCount > 0 && tabCount <= tabOrder.length
              ? tabOrder[tabCount - 1]
              : null;
          // Check if the expression references any of the flagged selectors
          // and the current focused element is that selector
          for (const sel of flaggedSelectors) {
            if (expr.includes(JSON.stringify(sel)) && currentFocused === sel) {
              return { result: { value: true } };
            }
          }
          return { result: { value: false } };
        }

        // Get focused element selector (expression includes document.activeElement
        // and builds a path selector)
        if (expr.includes('document.activeElement')) {
          const focused =
            tabCount > 0 && tabCount <= tabOrder.length
              ? tabOrder[tabCount - 1]
              : null;
          return { result: { value: focused } };
        }

        return { result: { value: null } };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveAriaHiddenFocus', () => {
  it('returns unchanged when no aria-hidden-focus incompletes', async () => {
    const cdp = buildTabTraversalMock([], []);
    const results = makeAxeResults({
      incomplete: [makeRule('image-alt', [makeNode('#img')])],
    });

    const cleaned = await resolveAriaHiddenFocus(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('violation when flagged element is reachable via Tab', async () => {
    // Tab order: #link -> #btn -> #hidden-btn (reached on tab 3)
    const tabOrder = ['#link', '#btn', '#hidden-btn', null];
    const cdp = buildTabTraversalMock(tabOrder, ['#hidden-btn']);

    const results = makeAxeResults({
      incomplete: [
        makeRule('aria-hidden-focus', [makeNode('#hidden-btn')]),
      ],
    });

    const cleaned = await resolveAriaHiddenFocus(cdp, results, { maxTabs: 10 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('aria-hidden-focus');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('pass when flagged element is NOT reachable via Tab', async () => {
    // Tab order never hits #hidden-btn — returns null after 3 tabs
    const tabOrder = ['#link', '#btn', '#other', null];
    const cdp = buildTabTraversalMock(tabOrder, ['#hidden-btn']);

    const results = makeAxeResults({
      incomplete: [
        makeRule('aria-hidden-focus', [makeNode('#hidden-btn')]),
      ],
    });

    const cleaned = await resolveAriaHiddenFocus(cdp, results, { maxTabs: 10 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('aria-hidden-focus');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('handles mixed results: one element reachable, one not', async () => {
    // Tab order: #link -> #hidden-a -> #btn -> null
    // #hidden-a is reachable (tab 2), #hidden-b is not
    const tabOrder = ['#link', '#hidden-a', '#btn', null];
    const cdp = buildTabTraversalMock(tabOrder, ['#hidden-a', '#hidden-b']);

    const results = makeAxeResults({
      incomplete: [
        makeRule('aria-hidden-focus', [
          makeNode('#hidden-a'),
          makeNode('#hidden-b'),
        ]),
      ],
    });

    const cleaned = await resolveAriaHiddenFocus(cdp, results, { maxTabs: 10 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].nodes).toHaveLength(1);
  });
});
