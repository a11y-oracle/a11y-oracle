import { test, expect } from '@playwright/test';
import { resolveSkipLink } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await page.goto('/skip-link-tests.html');
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

test.describe('skip-link resolver', () => {
  test('passes skip link that becomes visible on focus', async () => {
    const results = makeIncomplete(['#skip-visible']);
    const resolved = await resolveSkipLink(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'skip-link');
    expect(passRule).toBeDefined();
    expect(passRule!.nodes.some((n) => n.target[0] === '#skip-visible')).toBe(true);
  });

  test('violations skip link that stays hidden on focus', async () => {
    const results = makeIncomplete(['#skip-hidden']);
    const resolved = await resolveSkipLink(cdp, results);

    const violationRule = resolved.violations.find((r) => r.id === 'skip-link');
    expect(violationRule).toBeDefined();
    expect(violationRule!.nodes.some((n) => n.target[0] === '#skip-hidden')).toBe(true);
  });
});
