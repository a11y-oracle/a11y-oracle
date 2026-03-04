import { describe, it, expect } from 'vitest';
import { resolveLinkInTextBlock } from './link-in-text-block.js';
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

interface LinkStylesResponse {
  link: {
    textDecorationLine: string;
    borderBottomWidth: string;
    borderBottomStyle: string;
    fontWeight: string;
    color: string;
  };
  parent: {
    fontWeight: string;
    color: string;
  };
}

/**
 * Build a mock CDP session for the link-in-text-block resolver.
 *
 * The resolver makes one `Runtime.evaluate` call per node that
 * returns computed styles for the link and its parent element.
 */
function buildMockCDP(
  responsesBySelector: Record<string, LinkStylesResponse | null>,
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

describe('resolveLinkInTextBlock', () => {
  it('returns unchanged when no link-in-text-block incompletes exist', async () => {
    const cdp = buildMockCDP({});
    const results = makeAxeResults({
      incomplete: [
        makeRule('image-alt', [makeNode('#img')]),
      ],
    });

    const cleaned = await resolveLinkInTextBlock(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when link has underline', async () => {
    const cdp = buildMockCDP({
      '#link1': {
        link: {
          textDecorationLine: 'underline',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          fontWeight: '400',
          color: 'rgb(0, 0, 0)',
        },
        parent: {
          fontWeight: '400',
          color: 'rgb(0, 0, 0)',
        },
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('link-in-text-block', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveLinkInTextBlock(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('link-in-text-block');
    expect(cleaned.violations).toHaveLength(0);
  });

  it('passes when link has visible border-bottom', async () => {
    const cdp = buildMockCDP({
      '#link1': {
        link: {
          textDecorationLine: 'none',
          borderBottomWidth: '2px',
          borderBottomStyle: 'solid',
          fontWeight: '400',
          color: 'rgb(0, 0, 0)',
        },
        parent: {
          fontWeight: '400',
          color: 'rgb(0, 0, 0)',
        },
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('link-in-text-block', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveLinkInTextBlock(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('passes when link has different fontWeight from parent', async () => {
    const cdp = buildMockCDP({
      '#link1': {
        link: {
          textDecorationLine: 'none',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          fontWeight: '700',
          color: 'rgb(0, 0, 0)',
        },
        parent: {
          fontWeight: '400',
          color: 'rgb(0, 0, 0)',
        },
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('link-in-text-block', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveLinkInTextBlock(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('passes when link has sufficient color contrast (>= 3:1)', async () => {
    // Red (#ff0000) vs Black (#000000)
    // Red relative luminance ~0.2126, Black = 0
    // Ratio = (0.2126 + 0.05) / (0 + 0.05) = 5.25:1 → passes 3:1 threshold
    const cdp = buildMockCDP({
      '#link1': {
        link: {
          textDecorationLine: 'none',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          fontWeight: '400',
          color: 'rgb(255, 0, 0)',
        },
        parent: {
          fontWeight: '400',
          color: 'rgb(0, 0, 0)',
        },
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('link-in-text-block', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveLinkInTextBlock(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when no indicator and low contrast', async () => {
    // Two very similar grays: rgb(100,100,100) vs rgb(110,110,110)
    // Nearly identical luminance → contrast ratio well below 3:1
    const cdp = buildMockCDP({
      '#link1': {
        link: {
          textDecorationLine: 'none',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          fontWeight: '400',
          color: 'rgb(100, 100, 100)',
        },
        parent: {
          fontWeight: '400',
          color: 'rgb(110, 110, 110)',
        },
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('link-in-text-block', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveLinkInTextBlock(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('link-in-text-block');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });
});
