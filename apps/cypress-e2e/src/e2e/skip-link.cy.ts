/**
 * E2E tests for skip-link resolver via Cypress.
 *
 * Fixture: skip-link-tests.html
 *   A skip link that becomes visible on focus (pass) and one
 *   that stays offscreen even when focused (violation).
 */

import { resolveSkipLink } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';

// ── CDP helpers ────────────────────────────────────────────────────

function sendCDP(
  command: string,
  params: Record<string, unknown> = {},
): Promise<any> {
  return (Cypress as any).automation('remote:debugger:protocol', {
    command,
    params,
  });
}

async function setupAUTContext(): Promise<{
  frameId: string;
  contextId: number;
}> {
  await sendCDP('DOM.enable');
  await sendCDP('Page.enable');

  const result = await sendCDP('Page.getFrameTree');
  const childFrames = result.frameTree.childFrames || [];

  let frameId: string | null = null;
  for (const child of childFrames) {
    const url: string = child.frame.url || '';
    if (
      url &&
      !url.includes('/__/') &&
      !url.includes('__cypress') &&
      url !== 'about:blank'
    ) {
      frameId = child.frame.id;
      break;
    }
  }

  if (!frameId) {
    for (const child of childFrames) {
      if (child.frame.url && child.frame.url !== 'about:blank') {
        frameId = child.frame.id;
        break;
      }
    }
  }

  if (!frameId) throw new Error('Could not find AUT frame');

  const world = await sendCDP('Page.createIsolatedWorld', {
    frameId,
    worldName: 'skip-link-test',
    grantUniversalAccess: true,
  });

  return { frameId, contextId: world.executionContextId };
}

function createCDPAdapter(contextId: number): CDPSessionLike {
  return {
    send: (method: string, params?: Record<string, unknown>) => {
      const p = { ...params };
      if (method === 'Runtime.evaluate') {
        p['contextId'] = contextId;
      }
      return sendCDP(method, p);
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function makeIncomplete(selectors: string[]): AxeResults {
  return {
    violations: [],
    passes: [],
    incomplete: [
      {
        id: 'skip-link',
        impact: 'moderate',
        tags: ['wcag2a', 'wcag241'],
        description: 'Skip link',
        help: 'Skip links must be visible on focus',
        helpUrl: '',
        nodes: selectors.map((s) => ({
          target: [s],
          html: `<a id="${s.slice(1)}">Skip</a>`,
          any: [],
          all: [],
          none: [],
        })),
      },
    ],
    inapplicable: [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('skip-link resolver', () => {
  let cdpAdapter: CDPSessionLike;

  beforeEach(() => {
    cy.visit('/skip-link-tests.html');
    cy.wrap(null, { log: false }).then(async () => {
      const { contextId } = await setupAUTContext();
      cdpAdapter = createCDPAdapter(contextId);
    });
  });

  it('passes skip link that becomes visible on focus', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#skip-visible']);
      const resolved = await resolveSkipLink(cdpAdapter, results);

      const passRule = resolved.passes.find((r) => r.id === 'skip-link');
      expect(passRule).to.not.be.undefined;
      expect(
        passRule!.nodes.some((n) => n.target[0] === '#skip-visible'),
      ).to.be.true;
    });
  });

  it('violations skip link that stays hidden on focus', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#skip-hidden']);
      const resolved = await resolveSkipLink(cdpAdapter, results);

      const violationRule = resolved.violations.find(
        (r) => r.id === 'skip-link',
      );
      expect(violationRule).to.not.be.undefined;
      expect(
        violationRule!.nodes.some((n) => n.target[0] === '#skip-hidden'),
      ).to.be.true;
    });
  });
});
