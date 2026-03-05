/**
 * E2E tests for visual-engine and axe-bridge on the contrast test fixture.
 *
 * Fixture: contrast-tests.html
 *   Gradient backgrounds, CSS halos (stroke + shadow), solid backgrounds,
 *   large text thresholds, and background images — each exercises a
 *   different path through the visual contrast analysis pipeline.
 *
 * These tests use raw CDP access (not the a11y fixture) since
 * VisualContrastAnalyzer and resolveIncompleteContrast operate on
 * CDP sessions directly.
 */
import { test, expect } from '@playwright/test';
import { VisualContrastAnalyzer } from '@a11y-oracle/visual-engine';
import { resolveIncompleteContrast } from '@a11y-oracle/axe-bridge';
import type { AxeResults } from '@a11y-oracle/axe-bridge';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;

test.beforeEach(async ({ page }) => {
  await page.goto('/contrast-tests.html');
  cdp = await page.context().newCDPSession(page);
});

test.afterEach(async () => {
  await cdp?.detach();
});

test.describe('VisualContrastAnalyzer — Pixel Pipeline', () => {
  test('#gradient-pass exercises pixel pipeline on gradient background', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#gradient-pass');

    // The scrollIntoView fix ensures the gradient background is captured
    // correctly. Both extremes pass the contrast threshold.
    expect(result.category).toBe('pass');
    expect(result.pixels).not.toBeNull();
    expect(result.pixels!.crAgainstDarkest).toBeGreaterThan(10);
  });

  test('#split-gradient returns incomplete (split decision)', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#split-gradient');

    expect(result.category).toBe('incomplete');
    expect(result.reason).toContain('Split');
  });

  test('#solid-control passes with high contrast', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#solid-control');

    expect(result.category).toBe('pass');
  });

  test('#solid-fail returns violation (low contrast)', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#solid-fail');

    expect(result.category).toBe('violation');
  });
});

test.describe('VisualContrastAnalyzer — Halo Fast Path', () => {
  test('#stroke-halo passes via stroke halo', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#stroke-halo');

    expect(result.category).toBe('pass');
    expect(result.halo.hasValidHalo).toBe(true);
    expect(result.halo.method).toBe('stroke');
    // Halo fast path skips pixel analysis
    expect(result.pixels).toBeNull();
  });

  test('#stroke-thin rejects thin stroke (< 1px)', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#stroke-thin');

    // Thin stroke is rejected — falls through to pixel pipeline
    expect(result.halo.hasValidHalo).toBe(false);
  });

  test('#shadow-halo passes via shadow halo', async () => {
    const analyzer = new VisualContrastAnalyzer(cdp);
    const result = await analyzer.analyzeElement('#shadow-halo');

    expect(result.category).toBe('pass');
    expect(result.halo.hasValidHalo).toBe(true);
    expect(result.halo.method).toBe('shadow');
  });
});

test.describe('axe-bridge — resolveIncompleteContrast', () => {
  test('promotes pass and violation from incomplete results', async () => {
    // Build minimal mock AxeResults with two elements in incomplete
    const mockResults: AxeResults = {
      violations: [],
      passes: [],
      incomplete: [
        {
          id: 'color-contrast',
          impact: 'serious',
          tags: ['wcag2aa', 'wcag143'],
          description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum',
          help: 'Elements must meet minimum color contrast ratio thresholds',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
          nodes: [
            {
              target: ['#solid-control'],
              html: '<div id="solid-control">Dark text on white</div>',
              any: [{ id: 'color-contrast', data: {}, relatedNodes: [], message: '' }],
              all: [],
              none: [],
            },
            {
              target: ['#solid-fail'],
              html: '<div id="solid-fail">Light gray on white</div>',
              any: [{ id: 'color-contrast', data: {}, relatedNodes: [], message: '' }],
              all: [],
              none: [],
            },
          ],
        },
      ],
      inapplicable: [],
    };

    const resolved = await resolveIncompleteContrast(cdp, mockResults);

    // #solid-control should be promoted to passes
    const passRule = resolved.passes.find((r) => r.id === 'color-contrast');
    expect(passRule).toBeDefined();
    const passSelectors = passRule!.nodes.map((n) => n.target[0]);
    expect(passSelectors).toContain('#solid-control');

    // #solid-fail should be promoted to violations
    const violationRule = resolved.violations.find((r) => r.id === 'color-contrast');
    expect(violationRule).toBeDefined();
    const violationSelectors = violationRule!.nodes.map((n) => n.target[0]);
    expect(violationSelectors).toContain('#solid-fail');

    // incomplete color-contrast should be removed (both nodes resolved)
    const remainingIncomplete = resolved.incomplete.find((r) => r.id === 'color-contrast');
    expect(remainingIncomplete).toBeUndefined();
  });
});
