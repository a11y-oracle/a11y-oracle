import { describe, it, expect } from 'vitest';
import { resolveSkipLink } from './skip-link.js';
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

/** Default visibility props representing a visible, on-screen element. */
const VISIBLE_PROPS = {
  isFocused: true,
  width: 200,
  height: 30,
  top: 0,
  left: 0,
  right: 200,
  bottom: 30,
  opacity: '1',
  visibility: 'visible',
  display: 'block',
  clip: 'auto',
  clipPath: 'none',
  position: 'absolute',
  overflow: 'visible',
  viewportWidth: 1024,
  viewportHeight: 768,
};

/**
 * Build a mock CDP for skip-link tests.
 *
 * The resolver makes several Runtime.evaluate calls per node:
 * 1. Blur active element
 * 2. Focus the element via element.focus()
 * 3. Check visibility (contains getBoundingClientRect and getComputedStyle)
 */
function buildSkipLinkMock(
  visibilityData: Record<string, typeof VISIBLE_PROPS | null>,
): CDPSessionLike {
  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // blur active element
        if (expr.includes('blur()') && !expr.includes('getBoundingClientRect')) {
          return { result: { value: undefined } };
        }

        // focus the element
        if (expr.includes('.focus()') && !expr.includes('getBoundingClientRect')) {
          return { result: { value: undefined } };
        }

        // visibility check (contains getBoundingClientRect and getComputedStyle)
        if (expr.includes('getBoundingClientRect') && expr.includes('getComputedStyle')) {
          // Extract selector from the expression
          const selectorMatch = expr.match(/document\.querySelector\(("[^"]*")\)/);
          if (selectorMatch) {
            const selector = JSON.parse(selectorMatch[1]) as string;
            const data = visibilityData[selector] ?? null;
            return { result: { value: data } };
          }
          return { result: { value: null } };
        }

        return { result: { value: null } };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveSkipLink', () => {
  it('returns unchanged when no skip-link incompletes', async () => {
    const cdp = buildSkipLinkMock({});
    const results = makeAxeResults({
      incomplete: [makeRule('image-alt', [makeNode('#img')])],
    });

    const cleaned = await resolveSkipLink(cdp, results, { focusSettleDelay: 0 });
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when skip link is visible on focus', async () => {
    const cdp = buildSkipLinkMock({
      '#skip': { ...VISIBLE_PROPS },
    });
    const results = makeAxeResults({
      incomplete: [makeRule('skip-link', [makeNode('#skip')])],
    });

    const cleaned = await resolveSkipLink(cdp, results, { focusSettleDelay: 0 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('skip-link');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when skip link has display none', async () => {
    const cdp = buildSkipLinkMock({
      '#skip': { ...VISIBLE_PROPS, display: 'none' },
    });
    const results = makeAxeResults({
      incomplete: [makeRule('skip-link', [makeNode('#skip')])],
    });

    const cleaned = await resolveSkipLink(cdp, results, { focusSettleDelay: 0 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('skip-link');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('violation when skip link has zero dimensions', async () => {
    const cdp = buildSkipLinkMock({
      '#skip': { ...VISIBLE_PROPS, width: 0, height: 0 },
    });
    const results = makeAxeResults({
      incomplete: [makeRule('skip-link', [makeNode('#skip')])],
    });

    const cleaned = await resolveSkipLink(cdp, results, { focusSettleDelay: 0 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('violation when skip link is clipped to zero', async () => {
    const cdp = buildSkipLinkMock({
      '#skip': { ...VISIBLE_PROPS, clip: 'rect(0, 0, 0, 0)' },
    });
    const results = makeAxeResults({
      incomplete: [makeRule('skip-link', [makeNode('#skip')])],
    });

    const cleaned = await resolveSkipLink(cdp, results, { focusSettleDelay: 0 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('violation when skip link is positioned offscreen', async () => {
    const cdp = buildSkipLinkMock({
      '#skip': { ...VISIBLE_PROPS, right: -10, bottom: 30 },
    });
    const results = makeAxeResults({
      incomplete: [makeRule('skip-link', [makeNode('#skip')])],
    });

    const cleaned = await resolveSkipLink(cdp, results, { focusSettleDelay: 0 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });
});
