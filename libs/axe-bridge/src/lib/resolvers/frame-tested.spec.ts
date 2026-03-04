import { describe, it, expect } from 'vitest';
import { resolveFrameTested } from './frame-tested.js';
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
 * Build a mock CDP for frame-tested tests.
 *
 * The resolver:
 * 1. Page.getFrameTree — returns frame hierarchy
 * 2. Runtime.evaluate — gets iframe URL from DOM
 * 3. Page.createIsolatedWorld — creates execution context in iframe
 * 4. Runtime.evaluate — injects axe source (with contextId)
 * 5. Runtime.evaluate — runs axe.run() (with contextId and awaitPromise)
 */
function buildFrameMock(opts: {
  /** Frame tree returned by Page.getFrameTree. */
  frameTree: {
    frameTree: {
      frame: { id: string; url: string };
      childFrames?: { frame: { id: string; url: string } }[];
    };
  };
  /** URL returned for each iframe selector. null = element not found. */
  iframeUrls: Record<string, string | null>;
  /** Execution context ID returned by Page.createIsolatedWorld. */
  contextId: number;
  /** Whether axe injection and run should succeed. */
  shouldSucceed: boolean;
}): CDPSessionLike {
  let evalCallsWithContext = 0;

  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Page.getFrameTree') {
        return opts.frameTree;
      }

      if (method === 'Page.createIsolatedWorld') {
        return { executionContextId: opts.contextId };
      }

      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');
        const contextId = params?.['contextId'] as number | undefined;
        const awaitPromise = params?.['awaitPromise'] as boolean | undefined;

        // If there's a contextId, this is an iframe-scoped call
        if (contextId !== undefined) {
          evalCallsWithContext++;

          if (!opts.shouldSucceed) {
            throw new Error('Injection failed');
          }

          // First call with contextId: inject axe source
          if (!awaitPromise) {
            return { result: { value: undefined } };
          }

          // Second call with contextId: run axe (awaitPromise=true)
          return {
            result: {
              value: { violations: 0, incomplete: 0, passes: 5 },
            },
          };
        }

        // Get iframe URL from DOM (expression includes .src or getAttribute)
        if (expr.includes('.src') || expr.includes('getAttribute')) {
          // Extract selector from expression
          const selectorMatch = expr.match(/document\.querySelector\(("[^"]*")\)/);
          if (selectorMatch) {
            const selector = JSON.parse(selectorMatch[1]) as string;
            return { result: { value: opts.iframeUrls[selector] ?? null } };
          }
          return { result: { value: null } };
        }

        return { result: { value: null } };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveFrameTested', () => {
  it('returns unchanged when no frame-tested incompletes', async () => {
    const cdp = buildFrameMock({
      frameTree: {
        frameTree: {
          frame: { id: 'main', url: 'https://example.com' },
          childFrames: [],
        },
      },
      iframeUrls: {},
      contextId: 1,
      shouldSucceed: true,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('image-alt', [makeNode('#img')])],
    });

    const cleaned = await resolveFrameTested(cdp, results, {
      axeSource: '/* axe source */',
    });
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('returns unchanged when no axeSource option provided', async () => {
    const cdp = buildFrameMock({
      frameTree: {
        frameTree: {
          frame: { id: 'main', url: 'https://example.com' },
          childFrames: [],
        },
      },
      iframeUrls: {},
      contextId: 1,
      shouldSucceed: true,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('frame-tested', [makeNode('#iframe')])],
    });

    // No axeSource provided
    const cleaned = await resolveFrameTested(cdp, results);
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('frame-tested');
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when iframe is successfully tested', async () => {
    const cdp = buildFrameMock({
      frameTree: {
        frameTree: {
          frame: { id: 'main', url: 'https://example.com' },
          childFrames: [
            {
              frame: {
                id: 'frame-1',
                url: 'https://other.com/widget',
              },
            },
          ],
        },
      },
      iframeUrls: {
        '#iframe': 'https://other.com/widget',
      },
      contextId: 42,
      shouldSucceed: true,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('frame-tested', [makeNode('#iframe')])],
    });

    const cleaned = await resolveFrameTested(cdp, results, {
      axeSource: '/* axe-core source code */',
    });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('frame-tested');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('stays incomplete when iframe URL not found in frame tree', async () => {
    const cdp = buildFrameMock({
      frameTree: {
        frameTree: {
          frame: { id: 'main', url: 'https://example.com' },
          // No child frames that match
          childFrames: [
            {
              frame: {
                id: 'frame-1',
                url: 'https://completely-different.com',
              },
            },
          ],
        },
      },
      iframeUrls: {
        '#iframe': 'https://other.com/widget',
      },
      contextId: 42,
      shouldSucceed: true,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('frame-tested', [makeNode('#iframe')])],
    });

    const cleaned = await resolveFrameTested(cdp, results, {
      axeSource: '/* axe-core source code */',
    });
    // Should stay incomplete because the URL doesn't match any frame
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('frame-tested');
    expect(cleaned.incomplete[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('stays incomplete when injection fails', async () => {
    const cdp = buildFrameMock({
      frameTree: {
        frameTree: {
          frame: { id: 'main', url: 'https://example.com' },
          childFrames: [
            {
              frame: {
                id: 'frame-1',
                url: 'https://other.com/widget',
              },
            },
          ],
        },
      },
      iframeUrls: {
        '#iframe': 'https://other.com/widget',
      },
      contextId: 42,
      shouldSucceed: false,
    });

    const results = makeAxeResults({
      incomplete: [makeRule('frame-tested', [makeNode('#iframe')])],
    });

    const cleaned = await resolveFrameTested(cdp, results, {
      axeSource: '/* axe-core source code */',
    });
    // Should stay incomplete because injection threw an error
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('frame-tested');
    expect(cleaned.incomplete[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(0);
  });
});
