import { describe, it, expect } from 'vitest';
import { resolveFocusIndicator } from './focus-indicator.js';
import { encode } from 'fast-png';
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

/** Create a uniform PNG encoded as base64. */
function createUniformPng(
  r: number,
  g: number,
  b: number,
  w = 10,
  h = 10,
): string {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  const buf = encode({ width: w, height: h, data, channels: 4, depth: 8 });
  return Buffer.from(buf).toString('base64');
}

/**
 * Build a mock CDP for focus-indicator tests.
 *
 * The resolver:
 * 1. Enables Emulation.setFocusEmulationEnabled (try/catch)
 * 2. Blurs active element (Runtime.evaluate with blur())
 * 3. Gets bounding box (Runtime.evaluate with getBoundingClientRect)
 * 4. Takes a screenshot (Page.captureScreenshot) — before
 * 5. Focuses element via element.focus() (Runtime.evaluate)
 * 6. Takes another screenshot (Page.captureScreenshot) — after
 */
function buildFocusMock(opts: {
  bounds: { x: number; y: number; width: number; height: number } | null;
  beforePng: string;
  afterPng: string;
}): CDPSessionLike {
  let shotCount = 0;

  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Emulation.setFocusEmulationEnabled') return {};

      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // blur active element
        if (expr.includes('blur()') && !expr.includes('getBoundingClientRect')) {
          return { result: { value: undefined } };
        }

        // get bounding box
        if (expr.includes('getBoundingClientRect')) {
          return { result: { value: opts.bounds } };
        }

        // focus element
        if (expr.includes('.focus(')) {
          return { result: { value: undefined } };
        }

        return { result: { value: null } };
      }

      if (method === 'Page.captureScreenshot') {
        shotCount++;
        return { data: shotCount === 1 ? opts.beforePng : opts.afterPng };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveFocusIndicator', () => {
  it('returns unchanged when no focus-indicator incompletes', async () => {
    const cdp = buildFocusMock({
      bounds: { x: 0, y: 0, width: 100, height: 30 },
      beforePng: createUniformPng(255, 255, 255),
      afterPng: createUniformPng(255, 255, 255),
    });
    const results = makeAxeResults({
      incomplete: [makeRule('image-alt', [makeNode('#img')])],
    });

    const cleaned = await resolveFocusIndicator(cdp, results, {
      focusSettleDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when screenshots differ (focus indicator visible)', async () => {
    const whitePng = createUniformPng(255, 255, 255);
    const bluePng = createUniformPng(0, 0, 255);

    const cdp = buildFocusMock({
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      beforePng: whitePng,
      afterPng: bluePng,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('focus-indicator', [makeNode('#btn')])],
    });

    const cleaned = await resolveFocusIndicator(cdp, results, {
      focusSettleDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('focus-indicator');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when screenshots are identical (no focus indicator)', async () => {
    const whitePng = createUniformPng(255, 255, 255);

    const cdp = buildFocusMock({
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      beforePng: whitePng,
      afterPng: whitePng,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('focus-indicator', [makeNode('#btn')])],
    });

    const cleaned = await resolveFocusIndicator(cdp, results, {
      focusSettleDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('focus-indicator');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('handles missing element (stays incomplete)', async () => {
    const whitePng = createUniformPng(255, 255, 255);

    const cdp = buildFocusMock({
      bounds: null,
      beforePng: whitePng,
      afterPng: whitePng,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('focus-indicator', [makeNode('#missing')])],
    });

    const cleaned = await resolveFocusIndicator(cdp, results, {
      focusSettleDelay: 0,
    });
    // Node stays incomplete because bounds returned null
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('focus-indicator');
    expect(cleaned.incomplete[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });
});
