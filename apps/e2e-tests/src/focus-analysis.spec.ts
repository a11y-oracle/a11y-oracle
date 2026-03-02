/**
 * E2E tests for focus indicator analysis.
 *
 * Uses the focus-indicators.html sandbox fixture to verify
 * CSS analysis of focus indicators and WCAG 2.4.12 compliance.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Focus Indicator Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/focus-indicators.html');
  });

  test('good outline is visible with contrast', async ({ a11y, page }) => {
    // Focus the "Good Outline" button
    await page.focus('#good-outline-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();

    expect(state.focusIndicator.isVisible).toBe(true);
    expect(state.focusIndicator.contrastRatio).not.toBeNull();
    expect(state.focusIndicator.contrastRatio!).toBeGreaterThan(1);
  });

  test('box-shadow indicator is detected as visible', async ({ a11y, page }) => {
    await page.focus('#box-shadow-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();

    expect(state.focusIndicator.isVisible).toBe(true);
  });

  test('missing indicator is not visible', async ({ a11y, page }) => {
    await page.focus('#no-indicator-btn');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();

    expect(state.focusIndicator.isVisible).toBe(false);
    expect(state.focusIndicator.meetsWCAG_AA).toBe(false);
  });

  test('Tab through elements reports focus indicator for each', async ({
    a11y,
  }) => {
    // Tab to first button (good outline)
    const state1 = await a11y.pressKey('Tab');
    expect(state1.focusIndicator).toBeDefined();
    expect(typeof state1.focusIndicator.isVisible).toBe('boolean');

    // Tab to second button (box shadow)
    const state2 = await a11y.pressKey('Tab');
    expect(state2.focusIndicator).toBeDefined();
    expect(typeof state2.focusIndicator.isVisible).toBe('boolean');
  });
});
