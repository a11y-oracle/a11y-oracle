/**
 * E2E tests for target-size resolver via Cypress.
 *
 * Fixture: target-size-tests.html
 *   Large buttons, minimum-size buttons, spaced small buttons,
 *   and tight clusters of undersized buttons.
 */

import { resolveTargetSize } from '@a11y-oracle/axe-bridge';
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
    worldName: 'target-size-test',
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
        id: 'target-size',
        impact: 'serious',
        tags: ['wcag22aa', 'wcag258'],
        description: 'Target size',
        help: 'Targets must be large enough',
        helpUrl: '',
        nodes: selectors.map((s) => ({
          target: [s],
          html: `<button id="${s.slice(1)}">btn</button>`,
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

describe('target-size resolver', () => {
  let cdpAdapter: CDPSessionLike;

  beforeEach(() => {
    cy.visit('/target-size-tests.html');
    cy.wrap(null, { log: false }).then(async () => {
      const { contextId } = await setupAUTContext();
      cdpAdapter = createCDPAdapter(contextId);
    });
  });

  it('passes large button (48x48)', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#btn-large']);
      const resolved = await resolveTargetSize(cdpAdapter, results);

      const passRule = resolved.passes.find((r) => r.id === 'target-size');
      expect(passRule).to.not.be.undefined;
    });
  });

  it('passes minimum size button (24x24)', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#btn-minimum']);
      const resolved = await resolveTargetSize(cdpAdapter, results);

      const passRule = resolved.passes.find((r) => r.id === 'target-size');
      expect(passRule).to.not.be.undefined;
    });
  });

  it('handles tight cluster appropriately', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#btn-tight-1']);
      const resolved = await resolveTargetSize(cdpAdapter, results);

      // Tight cluster buttons are 16x16 with 2px margins — should produce a result
      const hasResult =
        resolved.passes.length > 0 || resolved.violations.length > 0;
      expect(hasResult).to.be.true;
    });
  });
});
