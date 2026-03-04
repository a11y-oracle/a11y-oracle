import { describe, it, expect } from 'vitest';
import { resolveScrollableRegionFocusable } from './scrollable-region-focusable.js';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, AxeRule } from '../types.js';

// ─── Shared test helpers ────────────────────────────────────────

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

// ─── Mock CDP ───────────────────────────────────────────────────

interface ScrollableRegionResponse {
  category: 'pass' | 'violation';
  reason: string;
}

/**
 * Build a mock CDP session for the scrollable-region-focusable resolver.
 *
 * The resolver makes one `Runtime.evaluate` per node that returns
 * `{ category, reason }`.
 */
function buildMockCDP(
  responsesBySelector: Record<string, ScrollableRegionResponse | null>,
): CDPSessionLike {
  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');
        for (const [sel, response] of Object.entries(responsesBySelector)) {
          if (expr.includes(JSON.stringify(sel).slice(1, -1))) {
            return { result: { value: response } };
          }
        }
        return { result: { value: null } };
      }
      return {};
    },
  } as CDPSessionLike;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('resolveScrollableRegionFocusable', () => {
  it('returns unchanged when no scrollable-region-focusable incompletes exist', async () => {
    const cdp = buildMockCDP({});
    const results = makeAxeResults({
      incomplete: [
        makeRule('image-alt', [makeNode('#img')]),
      ],
    });

    const cleaned = await resolveScrollableRegionFocusable(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when not actually scrollable', async () => {
    const cdp = buildMockCDP({
      '#container': { category: 'pass', reason: 'not-scrollable' },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('scrollable-region-focusable', [makeNode('#container')]),
      ],
    });

    const cleaned = await resolveScrollableRegionFocusable(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('scrollable-region-focusable');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('passes when container has tabindex', async () => {
    const cdp = buildMockCDP({
      '#container': { category: 'pass', reason: 'has-tabindex' },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('scrollable-region-focusable', [makeNode('#container')]),
      ],
    });

    const cleaned = await resolveScrollableRegionFocusable(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when no focusable children', async () => {
    const cdp = buildMockCDP({
      '#container': { category: 'violation', reason: 'no-focusable-children' },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('scrollable-region-focusable', [makeNode('#container')]),
      ],
    });

    const cleaned = await resolveScrollableRegionFocusable(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('scrollable-region-focusable');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when scroll reached', async () => {
    const cdp = buildMockCDP({
      '#container': { category: 'pass', reason: 'scroll-reached' },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('scrollable-region-focusable', [makeNode('#container')]),
      ],
    });

    const cleaned = await resolveScrollableRegionFocusable(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when content unreachable', async () => {
    const cdp = buildMockCDP({
      '#container': { category: 'violation', reason: 'unreachable-content' },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('scrollable-region-focusable', [makeNode('#container')]),
      ],
    });

    const cleaned = await resolveScrollableRegionFocusable(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('scrollable-region-focusable');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });
});
