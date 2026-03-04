import { test, expect } from '@playwright/test';
import { resolveIdenticalLinksSamePurpose } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await page.goto('/identical-links-tests.html');
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
        id: 'identical-links-same-purpose',
        impact: 'serious',
        tags: ['wcag2a', 'wcag244'],
        description: 'Links with the same accessible name have equivalent purpose',
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

test.describe('identical-links-same-purpose resolver', () => {
  test('promotes same-destination links to pass', async () => {
    const results = makeIncomplete(['#link-same-1']);
    const resolved = await resolveIdenticalLinksSamePurpose(cdp, results);

    expect(resolved.passes.length).toBeGreaterThanOrEqual(1);
    const passRule = resolved.passes.find((r) => r.id === 'identical-links-same-purpose');
    expect(passRule).toBeDefined();
  });

  test('promotes different-destination links to violation', async () => {
    const results = makeIncomplete(['#link-diff-1']);
    const resolved = await resolveIdenticalLinksSamePurpose(cdp, results);

    expect(resolved.violations.length).toBeGreaterThanOrEqual(1);
    const violationRule = resolved.violations.find((r) => r.id === 'identical-links-same-purpose');
    expect(violationRule).toBeDefined();
  });
});
