/**
 * E2E tests for link-in-text-block resolver via Cypress.
 *
 * Fixture: link-in-text-block-tests.html
 *   Links with various visual differentiation strategies: underline,
 *   border-bottom, bold, color contrast, and hover-only underline.
 *
 * IMPORTANT: The resolver checks DEFAULT state only. Hover/focus-only
 * differentiation is a Violation.
 */

import { resolveLinkInTextBlock } from '@a11y-oracle/axe-bridge';
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
    worldName: 'link-in-text-block-test',
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
        id: 'link-in-text-block',
        impact: 'serious',
        tags: ['wcag2a', 'wcag141'],
        description: 'Links can be distinguished from surrounding text',
        help: 'Links must be distinguishable without color',
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

describe('link-in-text-block resolver', () => {
  let cdpAdapter: CDPSessionLike;

  beforeEach(() => {
    cy.visit('/link-in-text-block-tests.html');
    cy.wrap(null, { log: false }).then(async () => {
      const { contextId } = await setupAUTContext();
      cdpAdapter = createCDPAdapter(contextId);
    });
  });

  it('passes link with underline', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-underline']);
      const resolved = await resolveLinkInTextBlock(cdpAdapter, results);

      const passRule = resolved.passes.find(
        (r) => r.id === 'link-in-text-block',
      );
      expect(passRule).to.not.be.undefined;
      expect(
        passRule!.nodes.some((n) => n.target[0] === '#link-underline'),
      ).to.be.true;
    });
  });

  it('passes link with border-bottom', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-border']);
      const resolved = await resolveLinkInTextBlock(cdpAdapter, results);

      const passRule = resolved.passes.find(
        (r) => r.id === 'link-in-text-block',
      );
      expect(passRule).to.not.be.undefined;
    });
  });

  it('passes link with bold font weight', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-bold']);
      const resolved = await resolveLinkInTextBlock(cdpAdapter, results);

      const passRule = resolved.passes.find(
        (r) => r.id === 'link-in-text-block',
      );
      expect(passRule).to.not.be.undefined;
    });
  });

  it('passes link with sufficient color contrast', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-color-good']);
      const resolved = await resolveLinkInTextBlock(cdpAdapter, results);

      const passRule = resolved.passes.find(
        (r) => r.id === 'link-in-text-block',
      );
      expect(passRule).to.not.be.undefined;
    });
  });

  it('violations link with insufficient differentiation', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-color-bad']);
      const resolved = await resolveLinkInTextBlock(cdpAdapter, results);

      const violationRule = resolved.violations.find(
        (r) => r.id === 'link-in-text-block',
      );
      expect(violationRule).to.not.be.undefined;
    });
  });

  it('violations link with hover-only underline', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#link-hover-only']);
      const resolved = await resolveLinkInTextBlock(cdpAdapter, results);

      // Should be a violation because the default state has no differentiation
      const violationRule = resolved.violations.find(
        (r) => r.id === 'link-in-text-block',
      );
      expect(violationRule).to.not.be.undefined;
    });
  });
});
