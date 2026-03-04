/**
 * E2E tests for focus-indicator resolver via Cypress.
 *
 * Fixture: focus-indicator-tests.html
 *   Buttons with outline, no indicator (outline: none), and
 *   box-shadow focus indicator.
 *
 * The resolver takes before/after screenshots and pixel-diffs them
 * to determine if a visible focus indicator exists.
 *
 * NOTE: Three Cypress-specific workarounds are needed here:
 *
 * 1. COORDINATE OFFSET — In Cypress the AUT runs inside an iframe that
 *    is offset from the viewport origin (reporter panel on the left,
 *    toolbar at the top). `getBoundingClientRect` returns coordinates
 *    relative to the iframe, but `Page.captureScreenshot` clips relative
 *    to the viewport. The CDP adapter dynamically fetches the iframe's
 *    viewport position and adjusts clip coordinates.
 *
 * 2. FOCUS STYLES — The AUT iframe doesn't have window-level focus, so
 *    CSS `:focus` pseudo-class styles may not render. The fixture uses
 *    a JS `.focused` class toggle on focus/blur events as a fallback.
 *
 * 3. IFRAME COMPOSITOR CACHE — Chrome's compositor may cache iframe content
 *    and return stale pixels for clipped screenshot regions. The adapter
 *    takes full-page screenshots and crops to the entire AUT iframe area
 *    using Canvas API, which reliably reflects focus-related style changes
 *    while excluding Cypress reporter UI noise.
 */

import { resolveFocusIndicator } from '@a11y-oracle/axe-bridge';
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
    worldName: 'focus-indicator-test',
    grantUniversalAccess: true,
  });

  return { frameId, contextId: world.executionContextId };
}

/**
 * Get the AUT iframe's dimensions in viewport coordinates.
 * Returns both the origin and size of the iframe's content area.
 */
async function getIframeBounds(): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const result = (await sendCDP('Runtime.evaluate', {
    expression: `(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const f of iframes) {
        const src = f.getAttribute('src') || f.src || '';
        if (src && !src.includes('/__/') && !src.includes('__cypress') && src !== 'about:blank') {
          const rect = f.getBoundingClientRect();
          return {
            x: rect.x + f.clientLeft,
            y: rect.y + f.clientTop,
            width: f.clientWidth,
            height: f.clientHeight,
          };
        }
      }
      return { x: 0, y: 0, width: 800, height: 600 };
    })()`,
    returnByValue: true,
  })) as {
    result: {
      value: { x: number; y: number; width: number; height: number };
    };
  };
  return result.result.value;
}

/**
 * Crop a region from a full-page screenshot using Canvas API.
 */
async function cropScreenshot(
  fullBase64: string,
  clip: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });
  img.src = `data:image/png;base64,${fullBase64}`;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = clip.width;
  canvas.height = clip.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    img,
    clip.x,
    clip.y,
    clip.width,
    clip.height,
    0,
    0,
    clip.width,
    clip.height,
  );

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}

/**
 * Create a CDP adapter that:
 * - Injects contextId for Runtime.evaluate (targets AUT frame's isolated world)
 * - Works around Chrome compositor caching for iframe screenshots:
 *   Takes full-page screenshots and crops to the entire AUT iframe area.
 *   Chrome's compositor may cache iframe content and return stale pixels
 *   for specific clip regions, but the top portion of the iframe reliably
 *   reflects style changes. Comparing the full iframe area captures these
 *   changes while excluding Cypress reporter UI noise.
 */
function createCDPAdapter(contextId: number): CDPSessionLike {
  return {
    send: async (method: string, params?: Record<string, unknown>) => {
      const p = { ...params };

      if (method === 'Runtime.evaluate') {
        p['contextId'] = contextId;
      }

      if (method === 'Page.captureScreenshot' && p['clip']) {
        // Take a full-page screenshot (no clip) and crop to the AUT
        // iframe area. Chrome's compositor may cache iframe content and
        // return stale pixels for specific element clip regions. However,
        // the top portion of the iframe reliably reflects focus-related
        // style changes. By cropping to the full iframe (not just the
        // element), we capture these changes while excluding Cypress
        // reporter UI that could cause false positives.
        const iframeBounds = await getIframeBounds();
        const fullShot = (await sendCDP('Page.captureScreenshot', {
          format: 'png',
        })) as { data: string };

        const croppedData = await cropScreenshot(fullShot.data, {
          x: Math.round(iframeBounds.x),
          y: Math.round(iframeBounds.y),
          width: Math.round(iframeBounds.width),
          height: Math.round(iframeBounds.height),
        });

        return { data: croppedData };
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
        id: 'focus-indicator',
        impact: 'serious',
        tags: ['wcag2aa', 'wcag247'],
        description: 'Focus indicator',
        help: 'Elements must have visible focus indicators',
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

describe('focus-indicator resolver', () => {
  let cdpAdapter: CDPSessionLike;

  beforeEach(() => {
    cy.visit('/focus-indicator-tests.html');
    cy.wrap(null, { log: false }).then(async () => {
      const { contextId } = await setupAUTContext();
      cdpAdapter = createCDPAdapter(contextId);
    });
  });

  it('passes button with outline focus indicator', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#btn-outline']);
      const resolved = await resolveFocusIndicator(cdpAdapter, results);

      const passRule = resolved.passes.find(
        (r) => r.id === 'focus-indicator',
      );
      expect(passRule).to.not.be.undefined;
    });
  });

  it('violations button with no focus indicator', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#btn-no-indicator']);
      const resolved = await resolveFocusIndicator(cdpAdapter, results);

      const violationRule = resolved.violations.find(
        (r) => r.id === 'focus-indicator',
      );
      expect(violationRule).to.not.be.undefined;
    });
  });

  it('passes button with box-shadow focus indicator', () => {
    cy.wrap(null, { log: false }).then(async () => {
      const results = makeIncomplete(['#btn-box-shadow']);
      const resolved = await resolveFocusIndicator(cdpAdapter, results);

      const passRule = resolved.passes.find(
        (r) => r.id === 'focus-indicator',
      );
      expect(passRule).to.not.be.undefined;
    });
  });
});
