import { test, expect } from '@playwright/test';
import { resolveFocusIndicator } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await page.goto('/focus-indicator-tests.html');
  cdp = await page.context().newCDPSession(page);
});

test.afterEach(async () => {
  await cdp?.detach();
});

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

test.describe('focus-indicator resolver', () => {
  test('passes button with outline focus indicator', async () => {
    const results = makeIncomplete(['#btn-outline']);
    const resolved = await resolveFocusIndicator(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'focus-indicator');
    expect(passRule).toBeDefined();
  });

  test('violations button with no focus indicator', async () => {
    const results = makeIncomplete(['#btn-no-indicator']);
    const resolved = await resolveFocusIndicator(cdp, results);

    const violationRule = resolved.violations.find((r) => r.id === 'focus-indicator');
    expect(violationRule).toBeDefined();
  });

  test('passes button with box-shadow focus indicator', async () => {
    const results = makeIncomplete(['#btn-box-shadow']);
    const resolved = await resolveFocusIndicator(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'focus-indicator');
    expect(passRule).toBeDefined();
  });
});
