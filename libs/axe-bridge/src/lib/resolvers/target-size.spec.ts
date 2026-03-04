import { describe, it, expect } from 'vitest';
import { resolveTargetSize } from './target-size.js';
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

interface TargetSizeResponse {
  target: { x: number; y: number; width: number; height: number };
  meetsMinSize: boolean;
  minDistance: number | null;
}

/**
 * Build a mock CDP session for the target-size resolver.
 *
 * The resolver makes one `Runtime.evaluate` per node that returns
 * `{ target, meetsMinSize, minDistance }`.
 */
function buildMockCDP(
  responsesBySelector: Record<string, TargetSizeResponse | null>,
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

describe('resolveTargetSize', () => {
  it('returns unchanged when no target-size incompletes exist', async () => {
    const cdp = buildMockCDP({});
    const results = makeAxeResults({
      incomplete: [
        makeRule('image-alt', [makeNode('#img')]),
      ],
    });

    const cleaned = await resolveTargetSize(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when element meets minimum size (24x24)', async () => {
    const cdp = buildMockCDP({
      '#btn': {
        target: { x: 50, y: 50, width: 24, height: 24 },
        meetsMinSize: true,
        minDistance: null,
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('target-size', [makeNode('#btn')]),
      ],
    });

    const cleaned = await resolveTargetSize(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('target-size');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('passes when undersized but has sufficient spacing', async () => {
    const cdp = buildMockCDP({
      '#btn': {
        target: { x: 50, y: 50, width: 16, height: 16 },
        meetsMinSize: false,
        minDistance: 30,
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('target-size', [makeNode('#btn')]),
      ],
    });

    const cleaned = await resolveTargetSize(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when undersized and too close to neighbor', async () => {
    const cdp = buildMockCDP({
      '#btn': {
        target: { x: 50, y: 50, width: 16, height: 16 },
        meetsMinSize: false,
        minDistance: 12,
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('target-size', [makeNode('#btn')]),
      ],
    });

    const cleaned = await resolveTargetSize(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('target-size');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('violation when undersized and no neighbors', async () => {
    const cdp = buildMockCDP({
      '#btn': {
        target: { x: 50, y: 50, width: 16, height: 16 },
        meetsMinSize: false,
        minDistance: null,
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('target-size', [makeNode('#btn')]),
      ],
    });

    const cleaned = await resolveTargetSize(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('target-size');
    expect(cleaned.passes).toHaveLength(0);
  });

  it('respects custom minSize option', async () => {
    // 20x20 target — fails default 24px but passes custom 16px
    const cdp = buildMockCDP({
      '#btn': {
        target: { x: 50, y: 50, width: 20, height: 20 },
        meetsMinSize: true,
        minDistance: null,
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('target-size', [makeNode('#btn')]),
      ],
    });

    const cleaned = await resolveTargetSize(cdp, results, { minSize: 16 });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });
});
