/**
 * E2E tests for identical-links-same-purpose resolver via Cypress.
 *
 * Fixture: identical-links-tests.html
 *   Multiple "Read More" links (same dest, different URL formats)
 *   and "Learn More" links (different destinations).
 */

import { resolveIdenticalLinksSamePurpose } from '@a11y-oracle/axe-bridge';
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
    worldName: 'identical-links-test',
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
        id: 'identical-links-same-purpose',
        impact: 'serious',
        tags: ['wcag2a', 'wcag244'],
        description:
          'Links with the same accessible name have equivalent purpose',
        help: 'Links with same name have same purpose',
        helpUrl: '',
        nodes: selectors.map((s) => ({
          target: [s],
          html: `<a id="${s.slice(1)}">link</a>`,
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

describe('identical-links-same-purpose resolver', () => {
  let cdpAdapter: CDPSessionLike;

  beforeEach(() => {
    cy.visit('/identical-links-tests.html');
    cy.wrap(null, { log: false }).then(async () => {
      const { contextId } = await setupAUTContext();
      cdpAdapter = createCDPAdapter(contextId);
    });
  });

  it('promotes same-destination links to pass', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-same-1']);
      const resolved = await resolveIdenticalLinksSamePurpose(
        cdpAdapter,
        results,
      );

      expect(resolved.passes.length).to.be.greaterThan(0);
      const passRule = resolved.passes.find(
        (r) => r.id === 'identical-links-same-purpose',
      );
      expect(passRule).to.not.be.undefined;
    });
  });

  it('promotes different-destination links to violation', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-diff-1']);
      const resolved = await resolveIdenticalLinksSamePurpose(
        cdpAdapter,
        results,
      );

      expect(resolved.violations.length).to.be.greaterThan(0);
      const violationRule = resolved.violations.find(
        (r) => r.id === 'identical-links-same-purpose',
      );
      expect(violationRule).to.not.be.undefined;
    });
  });
});
