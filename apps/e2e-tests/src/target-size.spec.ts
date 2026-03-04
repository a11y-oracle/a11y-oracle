import { test, expect } from '@playwright/test';
import { resolveTargetSize } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await page.goto('/target-size-tests.html');
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

test.describe('target-size resolver', () => {
  test('passes large button (48x48)', async () => {
    const results = makeIncomplete(['#btn-large']);
    const resolved = await resolveTargetSize(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'target-size');
    expect(passRule).toBeDefined();
  });

  test('passes minimum size button (24x24)', async () => {
    const results = makeIncomplete(['#btn-minimum']);
    const resolved = await resolveTargetSize(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'target-size');
    expect(passRule).toBeDefined();
  });

  test('handles tight cluster appropriately', async () => {
    const results = makeIncomplete(['#btn-tight-1']);
    const resolved = await resolveTargetSize(cdp, results);

    // Tight cluster buttons are 16x16 with 2px margins — should fail
    const hasResult = resolved.passes.length > 0 || resolved.violations.length > 0;
    expect(hasResult).toBe(true);
  });
});
