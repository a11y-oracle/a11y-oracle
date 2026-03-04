import { describe, it, expect } from 'vitest';
import { resolveContentOnHover } from './content-on-hover.js';
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
 * Build a mock CDP for content-on-hover tests.
 *
 * The resolver makes many Runtime.evaluate calls in sequence. We use
 * a counter to track the sequence of evaluate calls to return
 * appropriate responses at each stage.
 *
 * Sequence for each node:
 * 1. Setup (MutationObserver + trigger position) — returns {x, y} or null
 * 2. (hover mouse — Input.dispatchMouseEvent)
 * 3. Check content appeared — returns {x, y, visible} or null
 * 4. (move mouse to content — Input.dispatchMouseEvent)
 * 5. Check hoverable (content still visible) — returns boolean
 * 6. (move mouse back — Input.dispatchMouseEvent)
 * 7. (press Escape — Input.dispatchKeyEvent keyDown + keyUp)
 * 8. Check dismissed — returns boolean
 * 9. Cleanup (disconnect observer)
 *
 * @param opts Configuration for mock behavior
 */
function buildHoverMock(opts: {
  /** Trigger position, or null if element not found. */
  triggerPos: { x: number; y: number } | null;
  /** Content that appeared, or null if none appeared. */
  contentPos: { x: number; y: number; visible: boolean } | null;
  /** Whether content stays visible when hovered (hoverable test). */
  isHoverable: boolean;
  /** Whether content is dismissed by Escape. */
  isDismissible: boolean;
}): CDPSessionLike {
  let evalCount = 0;

  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Input.dispatchMouseEvent') {
        return {};
      }

      if (method === 'Input.dispatchKeyEvent') {
        return {};
      }

      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // Cleanup call — disconnect observer
        if (expr.includes('__a11yHoverObserver') && expr.includes('disconnect')) {
          return { result: { value: undefined } };
        }

        evalCount++;

        // Call 1: Setup — MutationObserver + trigger position
        if (evalCount === 1) {
          return { result: { value: opts.triggerPos } };
        }

        // If no trigger, we won't get further calls for this node
        if (!opts.triggerPos) {
          return { result: { value: null } };
        }

        // Call 2: Check content appeared
        if (evalCount === 2) {
          return { result: { value: opts.contentPos } };
        }

        // If no content appeared, the resolver stops here
        if (!opts.contentPos || !opts.contentPos.visible) {
          return { result: { value: null } };
        }

        // Call 3: Check hoverable (content still visible after mouse move)
        if (evalCount === 3) {
          return { result: { value: opts.isHoverable } };
        }

        // If not hoverable, resolver goes to cleanup — no more eval calls
        if (!opts.isHoverable) {
          return { result: { value: undefined } };
        }

        // Call 4: Check dismissed (content gone after Escape)
        if (evalCount === 4) {
          return { result: { value: opts.isDismissible } };
        }

        return { result: { value: null } };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveContentOnHover', () => {
  it('returns unchanged when no content-on-hover incompletes', async () => {
    const cdp = buildHoverMock({
      triggerPos: { x: 100, y: 100 },
      contentPos: null,
      isHoverable: true,
      isDismissible: true,
    });
    const results = makeAxeResults({
      incomplete: [makeRule('image-alt', [makeNode('#img')])],
    });

    const cleaned = await resolveContentOnHover(cdp, results, {
      hoverDelay: 0,
      dismissDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('image-alt');
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('passes when content is hoverable and dismissible', async () => {
    const cdp = buildHoverMock({
      triggerPos: { x: 100, y: 50 },
      contentPos: { x: 120, y: 80, visible: true },
      isHoverable: true,
      isDismissible: true,
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('content-on-hover', [makeNode('#trigger')]),
      ],
    });

    const cleaned = await resolveContentOnHover(cdp, results, {
      hoverDelay: 0,
      dismissDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(1);
    expect(cleaned.passes[0].id).toBe('content-on-hover');
    expect(cleaned.passes[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
  });

  it('violation when content is not hoverable', async () => {
    const cdp = buildHoverMock({
      triggerPos: { x: 100, y: 50 },
      contentPos: { x: 120, y: 80, visible: true },
      isHoverable: false,
      isDismissible: true,
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('content-on-hover', [makeNode('#trigger')]),
      ],
    });

    const cleaned = await resolveContentOnHover(cdp, results, {
      hoverDelay: 0,
      dismissDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('content-on-hover');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('violation when content is not dismissible', async () => {
    const cdp = buildHoverMock({
      triggerPos: { x: 100, y: 50 },
      contentPos: { x: 120, y: 80, visible: true },
      isHoverable: true,
      isDismissible: false,
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('content-on-hover', [makeNode('#trigger')]),
      ],
    });

    const cleaned = await resolveContentOnHover(cdp, results, {
      hoverDelay: 0,
      dismissDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(0);
    expect(cleaned.violations).toHaveLength(1);
    expect(cleaned.violations[0].id).toBe('content-on-hover');
    expect(cleaned.violations[0].nodes).toHaveLength(1);
    expect(cleaned.passes).toHaveLength(0);
  });

  it('stays incomplete when no hover content appears', async () => {
    const cdp = buildHoverMock({
      triggerPos: { x: 100, y: 50 },
      contentPos: null,
      isHoverable: true,
      isDismissible: true,
    });

    const results = makeAxeResults({
      incomplete: [
        makeRule('content-on-hover', [makeNode('#trigger')]),
      ],
    });

    const cleaned = await resolveContentOnHover(cdp, results, {
      hoverDelay: 0,
      dismissDelay: 0,
    });
    expect(cleaned.incomplete).toHaveLength(1);
    expect(cleaned.incomplete[0].id).toBe('content-on-hover');
    expect(cleaned.incomplete[0].nodes).toHaveLength(1);
    expect(cleaned.violations).toHaveLength(0);
    expect(cleaned.passes).toHaveLength(0);
  });
});
