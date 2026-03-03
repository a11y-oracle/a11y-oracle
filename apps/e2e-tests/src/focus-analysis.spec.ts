/**
 * E2E tests for focus indicator analysis.
 *
 * These tests verify that A11y-Oracle can inspect the CSS focus indicator
 * on focused elements and check WCAG 2.4.12 AA compliance (contrast
 * ratio >= 3.0 for visible focus indicators).
 *
 * Fixture: focus-indicators.html
 *   Five buttons with different focus indicator styles:
 *     #good-outline-btn  — 3px solid blue outline on dark bg (WCAG AA pass)
 *     #box-shadow-btn    — box-shadow: 0 0 0 3px #3498db (visible, non-outline)
 *     #no-indicator-btn  — outline: none with no replacement (WCAG fail)
 *     #low-contrast-btn  — light gray outline on light bg (low contrast)
 *     #dark-bg-btn       — red outline on very dark background (WCAG AA pass)
 *
 * To reproduce in your own app:
 *   1. Use `a11y.getA11yState()` after focusing an element to inspect its
 *      focus indicator CSS.
 *   2. Use `a11y.pressKey('Tab')` to Tab through elements — each returned
 *      A11yState includes `focusIndicator.isVisible` and `focusIndicator.meetsWCAG_AA`.
 *   3. Assert `state.focusIndicator.meetsWCAG_AA === true` for every
 *      interactive element in your app to catch WCAG 2.4.12 failures.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Focus Indicator Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/focus-indicators.html');
  });

  /**
   * Verify that a well-styled focus outline (3px solid blue on dark
   * background) is detected as visible with a measurable contrast ratio.
   *
   * Reproducing: Programmatically focus an element with `page.focus()`,
   * wait for CSS to apply, then call `a11y.getA11yState()`.
   * The `focusIndicator` field tells you if the indicator is visible
   * and what its contrast ratio is.
   */
  test('good outline is visible with contrast', async ({ a11y, page }) => {
    // Programmatically focus the button (instead of using Tab)
    await page.focus('#good-outline-btn');
    // Wait for CSS :focus styles to be applied
    await page.waitForTimeout(50);

    // getA11yState() collects speech + focused element + focus indicator
    const state = await a11y.getA11yState();

    // This button has a visible 3px blue outline — should be detected
    expect(state.focusIndicator.isVisible).toBe(true);
    // Contrast ratio should be parseable (not null) and greater than 1
    expect(state.focusIndicator.contrastRatio).not.toBeNull();
    expect(state.focusIndicator.contrastRatio!).toBeGreaterThan(1);
  });

  /**
   * Verify that box-shadow-based focus indicators (no outline) are
   * correctly detected as visible.
   *
   * Reproducing: Some designs use `box-shadow` instead of `outline` for
   * focus indicators. A11y-Oracle detects both approaches.
   */
  test('box-shadow indicator is detected as visible', async ({ a11y, page }) => {
    // Focus the button that uses box-shadow: 0 0 0 3px #3498db
    await page.focus('#box-shadow-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();

    // box-shadow based indicators are also detected as visible
    expect(state.focusIndicator.isVisible).toBe(true);
  });

  /**
   * Verify that elements with `outline: none` and no replacement
   * indicator are correctly flagged as not visible (WCAG 2.4.12 failure).
   *
   * Reproducing: This is the most common focus indicator bug — CSS resets
   * that remove outline without providing a replacement. Assert
   * `isVisible === false` to catch this in your test suite.
   */
  test('missing indicator is not visible', async ({ a11y, page }) => {
    // Focus the button with outline: none and no box-shadow replacement
    await page.focus('#no-indicator-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();

    // No visible focus indicator — WCAG 2.4.12 failure
    expect(state.focusIndicator.isVisible).toBe(false);
    expect(state.focusIndicator.meetsWCAG_AA).toBe(false);
  });

  /**
   * Verify that pressKey('Tab') returns focus indicator data for each
   * element as you Tab through the page — useful for auditing an entire
   * page's focus indicators in sequence.
   *
   * Reproducing: Loop through pressKey('Tab') calls and collect the
   * focusIndicator from each state to build a focus indicator audit.
   */
  test('Tab through elements reports focus indicator for each', async ({
    a11y,
  }) => {
    // Tab to first button (good outline) — pressKey returns full A11yState
    const state1 = await a11y.pressKey('Tab');
    expect(state1.focusIndicator).toBeDefined();
    expect(typeof state1.focusIndicator.isVisible).toBe('boolean');

    // Tab to second button (box shadow) — different indicator style
    const state2 = await a11y.pressKey('Tab');
    expect(state2.focusIndicator).toBeDefined();
    expect(typeof state2.focusIndicator.isVisible).toBe('boolean');
  });
});
