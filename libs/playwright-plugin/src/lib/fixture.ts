/**
 * @module fixture
 *
 * Playwright test fixture that provides an automatically managed
 * {@link A11yOracle} instance as the `a11y` fixture parameter.
 *
 * @example
 * ```typescript
 * import { test, expect } from '@a11y-oracle/playwright-plugin';
 *
 * test('navigation announces correctly', async ({ page, a11y }) => {
 *   await page.goto('/dropdown-nav.html');
 *
 *   const speech = await a11y.press('Tab');
 *   expect(speech).toBe('Products, button, collapsed');
 * });
 * ```
 */

import { test as base } from '@playwright/test';
import { A11yOracle } from './a11y-oracle.js';
import type { A11yOrchestratorOptions } from '@a11y-oracle/core-engine';

/**
 * Type definition for the A11y-Oracle Playwright fixtures.
 *
 * - `a11y`: An initialized {@link A11yOracle} instance, ready to use.
 * - `a11yOptions`: Configuration options for the orchestrator (speech engine
 *   and focus analysis). Override in `test.use()` to customize behavior.
 */
export type A11yOracleFixtures = {
  /** An initialized A11yOracle instance for the current page. */
  a11y: A11yOracle;
  /** Orchestrator options. Override via `test.use({ a11yOptions: { ... } })`. */
  a11yOptions: A11yOrchestratorOptions;
};

/**
 * Extended Playwright test with the `a11y` fixture.
 *
 * The fixture automatically:
 * 1. Creates a new {@link A11yOracle} instance for each test
 * 2. Initializes the CDP session
 * 3. Disposes the session after the test completes
 *
 * @example
 * ```typescript
 * import { test, expect } from '@a11y-oracle/playwright-plugin';
 *
 * test('button announces name and role', async ({ page, a11y }) => {
 *   await page.goto('/my-page.html');
 *   await a11y.press('Tab');
 *   expect(await a11y.getSpeech()).toBe('Submit, button');
 * });
 *
 * // Customize options for a test group:
 * test.describe('without landmarks', () => {
 *   test.use({ a11yOptions: { includeLandmarks: false } });
 *
 *   test('nav without landmark suffix', async ({ page, a11y }) => {
 *     await page.goto('/my-page.html');
 *     const all = await a11y.getFullTreeSpeech();
 *     const nav = all.find(r => r.role === 'navigation');
 *     expect(nav?.speech).toBe('Main, navigation');
 *   });
 * });
 * ```
 */
export const test = base.extend<A11yOracleFixtures>({
  // Default options (empty = use engine defaults)
  a11yOptions: [{}, { option: true }],

  a11y: async ({ page, a11yOptions }, use) => {
    const a11y = new A11yOracle(page, a11yOptions);
    await a11y.init();
    await use(a11y);
    await a11y.dispose();
  },
});

/** Re-export Playwright's expect for convenience. */
export { expect } from '@playwright/test';
