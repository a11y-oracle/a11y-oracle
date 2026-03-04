import { describe, it, expect } from 'vitest';
import { resolveAllIncomplete } from './resolve-all.js';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, AxeRule } from './types.js';

function makeNode(selector: string, overrides: Partial<AxeNode> = {}): AxeNode {
  return {
    target: [selector],
    html: `<span>${selector}</span>`,
    any: [
      {
        id: 'color-contrast',
        data: { fontSize: '16px', fontWeight: 'normal' },
        relatedNodes: [],
        message: 'Check',
      },
    ],
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
 * Build a minimal mock CDP that handles the basic calls made by
 * the resolvers. Each resolver's detailed behavior is tested in
 * its own spec file; here we just verify the orchestrator wiring.
 */
function buildOrchestratorMock(): CDPSessionLike {
  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      if (method === 'Runtime.evaluate') {
        const expr = String(params?.['expression'] ?? '');

        // identical-links-same-purpose: document.baseURI
        if (expr === 'document.baseURI') {
          return { result: { value: 'https://example.com' } };
        }

        // identical-links: get hrefs — all same destination
        if (expr.includes('relatedHrefs')) {
          return {
            result: {
              value: {
                href: '/page',
                relatedHrefs: ['/page'],
              },
            },
          };
        }

        // link-in-text-block: return link with underline (pass)
        if (expr.includes('textDecorationLine')) {
          return {
            result: {
              value: {
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
            },
          };
        }

        // target-size: return element that meets min size (pass)
        if (expr.includes('meetsMinSize')) {
          return {
            result: {
              value: {
                target: { x: 50, y: 50, width: 24, height: 24 },
                meetsMinSize: true,
                minDistance: null,
              },
            },
          };
        }

        // scrollable-region: return not scrollable (pass)
        if (expr.includes('scrollHeight')) {
          return {
            result: {
              value: { category: 'pass', reason: 'not-scrollable' },
            },
          };
        }

        return { result: { value: null } };
      }

      return {};
    },
  } as CDPSessionLike;
}

describe('resolveAllIncomplete', () => {
  it('returns results unchanged when no incomplete entries exist', async () => {
    const cdp = buildOrchestratorMock();
    const results = makeAxeResults();

    const resolved = await resolveAllIncomplete(cdp, results);
    expect(resolved.incomplete).toHaveLength(0);
    expect(resolved.violations).toHaveLength(0);
    expect(resolved.passes).toHaveLength(0);
  });

  it('resolves multiple rules in a single pass', async () => {
    const cdp = buildOrchestratorMock();
    const results = makeAxeResults({
      incomplete: [
        makeRule('identical-links-same-purpose', [makeNode('#link1')]),
        makeRule('link-in-text-block', [makeNode('#link2')]),
        makeRule('target-size', [makeNode('#btn1')]),
        makeRule('scrollable-region-focusable', [makeNode('#scroll1')]),
      ],
    });

    const resolved = await resolveAllIncomplete(cdp, results);

    // All four rules should be resolved — no incompletes left
    expect(resolved.incomplete).toHaveLength(0);
    // All should have been promoted to passes (based on mock data)
    expect(resolved.passes).toHaveLength(4);
  });

  it('skips rules listed in skipRules', async () => {
    const cdp = buildOrchestratorMock();
    const results = makeAxeResults({
      incomplete: [
        makeRule('identical-links-same-purpose', [makeNode('#link1')]),
        makeRule('target-size', [makeNode('#btn1')]),
      ],
    });

    const resolved = await resolveAllIncomplete(cdp, results, {
      skipRules: ['target-size'],
    });

    // identical-links resolved, target-size skipped
    expect(resolved.incomplete).toHaveLength(1);
    expect(resolved.incomplete[0].id).toBe('target-size');
    expect(resolved.passes).toHaveLength(1);
    expect(resolved.passes[0].id).toBe('identical-links-same-purpose');
  });

  it('preserves non-targeted incomplete rules', async () => {
    const cdp = buildOrchestratorMock();
    const results = makeAxeResults({
      incomplete: [
        makeRule('identical-links-same-purpose', [makeNode('#link1')]),
        makeRule('some-unknown-rule', [makeNode('#el')]),
      ],
    });

    const resolved = await resolveAllIncomplete(cdp, results);

    // unknown rule stays incomplete, known rule resolved
    expect(resolved.incomplete).toHaveLength(1);
    expect(resolved.incomplete[0].id).toBe('some-unknown-rule');
    expect(resolved.passes).toHaveLength(1);
  });
});
