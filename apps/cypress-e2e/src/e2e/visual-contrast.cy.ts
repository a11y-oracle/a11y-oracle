/**
 * E2E tests for visual-engine contrast analysis via Cypress.
 *
 * Fixture: contrast-tests.html
 *   Gradient backgrounds, CSS halos (stroke + shadow), solid backgrounds —
 *   each exercises a different path through the visual contrast analysis
 *   pipeline.
 *
 * These tests import VisualContrastAnalyzer and resolveIncompleteContrast
 * directly and build a minimal CDPSessionLike adapter from
 * `Cypress.automation('remote:debugger:protocol')`.
 *
 * Because Cypress runs the AUT in an iframe, Runtime.evaluate calls
 * must target the AUT frame's execution context. We discover the frame
 * and create an isolated world — the same pattern used by commands.ts.
 */

import { VisualContrastAnalyzer } from '@a11y-oracle/visual-engine';
import { resolveIncompleteContrast } from '@a11y-oracle/axe-bridge';
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

/**
 * Discover the AUT iframe's frameId and create an isolated execution
 * context for Runtime.evaluate calls.
 */
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
    worldName: 'visual-contrast-test',
    grantUniversalAccess: true,
  });

  return { frameId, contextId: world.executionContextId };
}

async function getAUTIframeBounds(): Promise<{ x: number; y: number }> {
  const result = await sendCDP('Runtime.evaluate', {
    expression: `(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const f of iframes) {
        const src = f.getAttribute('src') || f.src || '';
        if (src && !src.includes('/__/') && !src.includes('__cypress') && src !== 'about:blank') {
          const rect = f.getBoundingClientRect();
          return { x: rect.x + f.clientLeft, y: rect.y + f.clientTop };
        }
      }
      return { x: 0, y: 0 };
    })()`,
    returnByValue: true,
  });
  return result.result.value;
}

function createCDPAdapter(
  contextId: number,
  iframeBounds: { x: number; y: number },
): CDPSessionLike {
  return {
    send: (method: string, params?: Record<string, unknown>) => {
      const p = { ...params };
      if (method === 'Runtime.evaluate') {
        p['contextId'] = contextId;
      }
      // Translate iframe-relative clip coordinates to viewport coordinates
      if (
        method === 'Page.captureScreenshot' &&
        p['clip'] &&
        (iframeBounds.x !== 0 || iframeBounds.y !== 0)
      ) {
        const clip = p['clip'] as Record<string, number>;
        p['clip'] = {
          ...clip,
          x: clip.x + iframeBounds.x,
          y: clip.y + iframeBounds.y,
        };
      }
      return sendCDP(method, p);
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Visual Contrast Analysis', () => {
  let cdpAdapter: CDPSessionLike;

  beforeEach(() => {
    cy.visit('/contrast-tests.html');
    cy.wrap(null, { log: false }).then(async () => {
      const { contextId } = await setupAUTContext();
      const iframeBounds = await getAUTIframeBounds();
      cdpAdapter = createCDPAdapter(contextId, iframeBounds);
    });
  });

  describe('Pixel Pipeline', () => {
    it('#gradient-pass exercises pixel pipeline on gradient background', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#gradient-pass');

        // The pixel pipeline runs on the gradient background. In Cypress's
        // iframe context, rounded corners may pick up runner-chrome pixels
        // causing a split decision, or both extremes may pass outright.
        expect(result.category).to.be.oneOf(['pass', 'incomplete']);
        expect(result.pixels).to.not.be.null;
        expect(result.pixels!.crAgainstDarkest).to.be.greaterThan(10);
      });
    });

    it('#split-gradient returns violation or incomplete (split decision)', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#split-gradient');

        // With accurate iframe capture, both extremes may fail (violation)
        // or produce a split decision (incomplete) depending on captured pixels.
        expect(result.category).to.be.oneOf(['violation', 'incomplete']);
      });
    });

    it('#solid-control passes with high contrast', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#solid-control');

        expect(result.category).to.equal('pass');
      });
    });

    it('#solid-fail returns violation (low contrast)', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#solid-fail');

        expect(result.category).to.equal('violation');
      });
    });
  });

  describe('Halo Fast Path', () => {
    it('#stroke-halo passes via stroke halo', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#stroke-halo');

        expect(result.category).to.equal('pass');
        expect(result.halo.hasValidHalo).to.be.true;
        expect(result.halo.method).to.equal('stroke');
        // Halo fast path skips pixel analysis
        expect(result.pixels).to.be.null;
      });
    });

    it('#stroke-thin rejects thin stroke (< 1px)', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#stroke-thin');

        // Thin stroke is rejected — falls through to pixel pipeline
        expect(result.halo.hasValidHalo).to.be.false;
      });
    });

    it('#shadow-halo passes via shadow halo', () => {
      cy.wrap(null, { log: false }).then(async () => {
        const analyzer = new VisualContrastAnalyzer(cdpAdapter);
        const result = await analyzer.analyzeElement('#shadow-halo');

        expect(result.category).to.equal('pass');
        expect(result.halo.hasValidHalo).to.be.true;
        expect(result.halo.method).to.equal('shadow');
      });
    });
  });

  describe('axe-bridge — resolveIncompleteContrast', () => {
    it('promotes pass and violation from incomplete results', () => {
      cy.wrap(null, { log: false }).then(async () => {
        // Build minimal mock AxeResults with two elements in incomplete
        const mockResults: AxeResults = {
          violations: [],
          passes: [],
          incomplete: [
            {
              id: 'color-contrast',
              impact: 'serious',
              tags: ['wcag2aa', 'wcag143'],
              description:
                'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum',
              help: 'Elements must meet minimum color contrast ratio thresholds',
              helpUrl:
                'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
              nodes: [
                {
                  target: ['#solid-control'],
                  html: '<div id="solid-control">Dark text on white</div>',
                  any: [
                    {
                      id: 'color-contrast',
                      data: {},
                      relatedNodes: [],
                      message: '',
                    },
                  ],
                  all: [],
                  none: [],
                },
                {
                  target: ['#solid-fail'],
                  html: '<div id="solid-fail">Light gray on white</div>',
                  any: [
                    {
                      id: 'color-contrast',
                      data: {},
                      relatedNodes: [],
                      message: '',
                    },
                  ],
                  all: [],
                  none: [],
                },
              ],
            },
          ],
          inapplicable: [],
        };

        const resolved = await resolveIncompleteContrast(
          cdpAdapter,
          mockResults,
        );

        // #solid-control should be promoted to passes
        const passRule = resolved.passes.find(
          (r) => r.id === 'color-contrast',
        );
        expect(passRule).to.not.be.undefined;
        const passSelectors = passRule!.nodes.map((n) => n.target[0]);
        expect(passSelectors).to.include('#solid-control');

        // #solid-fail should be promoted to violations
        const violationRule = resolved.violations.find(
          (r) => r.id === 'color-contrast',
        );
        expect(violationRule).to.not.be.undefined;
        const violationSelectors = violationRule!.nodes.map(
          (n) => n.target[0],
        );
        expect(violationSelectors).to.include('#solid-fail');

        // incomplete color-contrast should be removed (both nodes resolved)
        const remainingIncomplete = resolved.incomplete.find(
          (r) => r.id === 'color-contrast',
        );
        expect(remainingIncomplete).to.be.undefined;
      });
    });
  });
});
