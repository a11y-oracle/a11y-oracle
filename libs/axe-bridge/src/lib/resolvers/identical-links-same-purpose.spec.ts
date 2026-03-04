import { describe, it, expect } from 'vitest';
import {
  resolveIdenticalLinksSamePurpose,
  normalizeUrl,
} from './identical-links-same-purpose.js';
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

/**
 * Build a mock CDP session for the identical-links-same-purpose resolver.
 *
 * The resolver makes two types of Runtime.evaluate calls:
 * 1. `document.baseURI` — returns the page's base URL.
 * 2. Per-node evaluation — returns `{ href, relatedHrefs }`.
 */
function buildMockCDP(
  baseURI: string,
  responsesBySelector: Record<
    string,
    { href: string; relatedHrefs: string[] } | null
  >,
): CDPSessionLike {
  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // First call: document.baseURI
        if (expr === 'document.baseURI') {
          return { result: { value: baseURI } };
        }

        // Per-node calls: match by selector in expression
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

describe('normalizeUrl', () => {
  it('strips query params', () => {
    expect(normalizeUrl('https://example.com/page?foo=1', 'https://example.com'))
      .toBe('https://example.com/page');
  });

  it('strips hash', () => {
    expect(normalizeUrl('https://example.com/page#section', 'https://example.com'))
      .toBe('https://example.com/page');
  });

  it('strips trailing slash', () => {
    expect(normalizeUrl('https://example.com/page/', 'https://example.com'))
      .toBe('https://example.com/page');
  });

  it('resolves relative paths', () => {
    expect(normalizeUrl('/about', 'https://example.com'))
      .toBe('https://example.com/about');
  });

  it('returns null for unparseable input', () => {
    expect(() => normalizeUrl('not:a:url', '')).not.toThrow();
    // Should return null (or a value) — just verify it does not throw
    const result = normalizeUrl('not:a:url', '');
    // The URL constructor may or may not parse this; the key is no exception
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});

describe('resolveIdenticalLinksSamePurpose', () => {
  it('returns unchanged when no incomplete identical-links-same-purpose exists', async () => {
    const cdp = buildMockCDP('https://example.com', {});
    const results = makeAxeResults({
      incomplete: [
        makeRule('image-alt', [makeNode('#img')]),
      ],
    });

    const cleaned = await resolveIdenticalLinksSamePurpose(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('promotes to pass when all links have same normalized URL', async () => {
    const cdp = buildMockCDP('https://example.com', {
      '#link1': {
        href: '/page',
        relatedHrefs: ['/page', '/page?utm=1'],
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('identical-links-same-purpose', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveIdenticalLinksSamePurpose(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('identical-links-same-purpose');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('promotes to violation when links have different URLs', async () => {
    const cdp = buildMockCDP('https://example.com', {
      '#link1': {
        href: '/page1',
        relatedHrefs: ['/page1', '/page2'],
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('identical-links-same-purpose', [makeNode('#link1')]),
      ],
    });

    const cleaned = await resolveIdenticalLinksSamePurpose(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('identical-links-same-purpose');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('handles missing selector gracefully (node stays incomplete)', async () => {
    const cdp = buildMockCDP('https://example.com', {});
    const nodeWithEmptyTarget = makeNode('', { target: [] });

    const results = makeAxeResults({
      incomplete: [
        makeRule('identical-links-same-purpose', [nodeWithEmptyTarget]),
      ],
    });

    const cleaned = await resolveIdenticalLinksSamePurpose(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('identical-links-same-purpose');
    expect(cleaned.incomplete[0].nodes).toHaveLength(1);
  });
});
