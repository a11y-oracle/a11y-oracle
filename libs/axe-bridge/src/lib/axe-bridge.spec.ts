import { describe, it, expect } from 'vitest';
import { encode } from 'fast-png';
import { resolveIncompleteContrast } from './axe-bridge.js';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, AxeRule } from './types.js';

/** Create a synthetic PNG buffer of uniform color. */
function createUniformPng(r: number, g: number, b: number): Uint8Array {
  const width = 10;
  const height = 10;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < 100; i++) {
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return encode({ width, height, data, channels: 4, depth: 8 });
}

function makeNode(selector: string, overrides: Partial<AxeNode> = {}): AxeNode {
  return {
    target: [selector],
    html: `<span class="test">${selector}</span>`,
    any: [
      {
        id: 'color-contrast',
        data: { fontSize: '16px', fontWeight: 'normal' },
        relatedNodes: [],
        impact: 'serious',
        message: 'Element has insufficient color contrast',
      },
    ],
    all: [],
    none: [],
    impact: 'serious',
    failureSummary: 'Fix any of the following: Element has insufficient color contrast',
    ...overrides,
  };
}

function makeColorContrastRule(nodes: AxeNode[]): AxeRule {
  return {
    id: 'color-contrast',
    impact: 'serious',
    tags: ['cat.color', 'wcag2aa', 'wcag143'],
    description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
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
 * Build a mock CDP for the axe-bridge tests.
 * Each call to analyzeElement makes 3-4 Runtime.evaluate calls
 * and 1 Page.captureScreenshot call per node.
 */
function buildMockCDP(opts: {
  /** Background screenshot color per selector. Default: white. */
  backgrounds?: Record<string, { r: number; g: number; b: number }>;
  /** Text color per selector. Default: 'rgb(0, 0, 0)'. */
  textColors?: Record<string, string>;
}): CDPSessionLike {
  const backgrounds = opts.backgrounds ?? {};
  const textColors = opts.textColors ?? {};
  let currentSelector = '';
  let callIndex = 0;

  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // Detect which selector is being queried
        const selectorMatch = expr.match(/document\.querySelector\("([^"]+)"\)/);
        if (selectorMatch) {
          currentSelector = selectorMatch[1];
        }

        // getElementStyles (checks for 'webkitTextStrokeWidth')
        if (expr.includes('webkitTextStrokeWidth')) {
          return {
            result: {
              value: {
                color: textColors[currentSelector] ?? 'rgb(0, 0, 0)',
                backgroundColor: 'transparent',
                textStrokeWidth: '0px',
                textStrokeColor: '',
                textShadow: 'none',
                backgroundImage: 'none',
              },
            },
          };
        }

        // isDynamicContent (checks for 'VIDEO')
        if (expr.includes('VIDEO')) {
          return { result: { value: false } };
        }

        // getCaptureInfoAndHide (checks for 'getBoundingClientRect')
        if (expr.includes('getBoundingClientRect')) {
          return {
            result: {
              value: {
                color: textColors[currentSelector] ?? 'rgb(0, 0, 0)',
                x: 0,
                y: 0,
                width: 100,
                height: 20,
              },
            },
          };
        }

        // restoreText (checks for 'removeProperty')
        if (expr.includes('removeProperty')) {
          return { result: { value: true } };
        }

        return { result: { value: null } };
      }

      if (method === 'Page.captureScreenshot') {
        const bg = backgrounds[currentSelector] ?? { r: 255, g: 255, b: 255 };
        const buf = createUniformPng(bg.r, bg.g, bg.b);
        return { data: Buffer.from(buf).toString('base64') };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveIncompleteContrast', () => {
  it('returns results unchanged when no color-contrast incompletes exist', async () => {
    const cdp = buildMockCDP({});
    const results = makeAxeResults({
      incomplete: [
        {
          id: 'image-alt',
          impact: 'critical',
          tags: ['wcag2a'],
          description: 'Images must have alt text',
          help: 'Images must have alt text',
          helpUrl: '',
          nodes: [makeNode('#img')],
        },
      ],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('promotes all nodes to passes when contrast is good', async () => {
    // Black text on white background: ~21:1
    const cdp = buildMockCDP({
      textColors: { '#good': 'rgb(0, 0, 0)' },
      backgrounds: { '#good': { r: 255, g: 255, b: 255 } },
    });

    const results = makeAxeResults({
      incomplete: [makeColorContrastRule([makeNode('#good')])],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('color-contrast');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('promotes all nodes to violations when contrast is bad', async () => {
    // White text on white background: ~1:1
    const cdp = buildMockCDP({
      textColors: { '#bad': 'rgb(255, 255, 255)' },
      backgrounds: { '#bad': { r: 255, g: 255, b: 255 } },
    });

    const results = makeAxeResults({
      incomplete: [makeColorContrastRule([makeNode('#bad')])],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('handles mixed results: some pass, some violate', async () => {
    const cdp = buildMockCDP({
      textColors: {
        '#good': 'rgb(0, 0, 0)',
        '#bad': 'rgb(255, 255, 255)',
      },
      backgrounds: {
        '#good': { r: 255, g: 255, b: 255 },
        '#bad': { r: 255, g: 255, b: 255 },
      },
    });

    const results = makeAxeResults({
      incomplete: [
        makeColorContrastRule([makeNode('#good'), makeNode('#bad')]),
      ],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(1);
  });

  it('uses large text threshold (3.0) for big fonts', async () => {
    // Gray text (~3.84:1) on white — fails 4.5 but passes 3.0
    const cdp = buildMockCDP({
      textColors: { '#large': 'rgb(130, 130, 130)' },
      backgrounds: { '#large': { r: 255, g: 255, b: 255 } },
    });

    const largeNode = makeNode('#large', {
      any: [
        {
          id: 'color-contrast',
          data: { fontSize: '24px', fontWeight: 'normal' },
          relatedNodes: [],
          message: 'Insufficient contrast',
        },
      ],
    });

    const results = makeAxeResults({
      incomplete: [makeColorContrastRule([largeNode])],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    // Should pass because 24px is large text → threshold = 3.0
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('preserves other incomplete rules', async () => {
    const cdp = buildMockCDP({
      textColors: { '#cc': 'rgb(0, 0, 0)' },
      backgrounds: { '#cc': { r: 255, g: 255, b: 255 } },
    });

    const results = makeAxeResults({
      incomplete: [
        makeColorContrastRule([makeNode('#cc')]),
        {
          id: 'image-alt',
          impact: 'critical',
          tags: ['wcag2a'],
          description: '',
          help: '',
          helpUrl: '',
          nodes: [makeNode('#img')],
        },
      ],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    // color-contrast resolved, image-alt preserved
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
  });

  it('does not mutate the original axeResults', async () => {
    const cdp = buildMockCDP({
      textColors: { '#el': 'rgb(0, 0, 0)' },
      backgrounds: { '#el': { r: 255, g: 255, b: 255 } },
    });

    const original = makeAxeResults({
      incomplete: [makeColorContrastRule([makeNode('#el')])],
    });

    const originalJson = JSON.stringify(original);
    await resolveIncompleteContrast(cdp, original);
    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it('appends to existing violations when color-contrast rule already present', async () => {
    const cdp = buildMockCDP({
      textColors: { '#bad2': 'rgb(255, 255, 255)' },
      backgrounds: { '#bad2': { r: 255, g: 255, b: 255 } },
    });

    const existingViolation = makeColorContrastRule([makeNode('#bad1')]);
    const results = makeAxeResults({
      violations: [existingViolation],
      incomplete: [makeColorContrastRule([makeNode('#bad2')])],
    });

    const cleaned = await resolveIncompleteContrast(cdp, results);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].nodes).toHaveLength(2);
  });
});
