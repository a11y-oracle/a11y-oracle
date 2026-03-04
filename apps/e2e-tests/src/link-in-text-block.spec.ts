import { test, expect } from '@playwright/test';
import { resolveLinkInTextBlock } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await page.goto('/link-in-text-block-tests.html');
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

test.describe('link-in-text-block resolver', () => {
  test('passes link with underline', async () => {
    const results = makeIncomplete(['#link-underline']);
    const resolved = await resolveLinkInTextBlock(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'link-in-text-block');
    expect(passRule).toBeDefined();
    expect(passRule!.nodes.some((n) => n.target[0] === '#link-underline')).toBe(true);
  });

  test('passes link with border-bottom', async () => {
    const results = makeIncomplete(['#link-border']);
    const resolved = await resolveLinkInTextBlock(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'link-in-text-block');
    expect(passRule).toBeDefined();
  });

  test('passes link with bold font weight', async () => {
    const results = makeIncomplete(['#link-bold']);
    const resolved = await resolveLinkInTextBlock(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'link-in-text-block');
    expect(passRule).toBeDefined();
  });

  test('passes link with sufficient color contrast', async () => {
    const results = makeIncomplete(['#link-color-good']);
    const resolved = await resolveLinkInTextBlock(cdp, results);

    const passRule = resolved.passes.find((r) => r.id === 'link-in-text-block');
    expect(passRule).toBeDefined();
  });

  test('violations link with insufficient differentiation', async () => {
    const results = makeIncomplete(['#link-color-bad']);
    const resolved = await resolveLinkInTextBlock(cdp, results);

    const violationRule = resolved.violations.find((r) => r.id === 'link-in-text-block');
    expect(violationRule).toBeDefined();
  });

  test('violations link with hover-only underline', async () => {
    const results = makeIncomplete(['#link-hover-only']);
    const resolved = await resolveLinkInTextBlock(cdp, results);

    // Should be a violation because the default state has no differentiation
    const violationRule = resolved.violations.find((r) => r.id === 'link-in-text-block');
    expect(violationRule).toBeDefined();
  });
});
