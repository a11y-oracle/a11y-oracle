/**
 * @module @a11y-oracle/playwright-plugin
 *
 * Playwright integration for A11y-Oracle. Provides a test fixture and
 * wrapper class for asserting accessibility speech output in Playwright
 * tests.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { test, expect } from '@a11y-oracle/playwright-plugin';
 *
 * test('button announces correctly', async ({ page, a11y }) => {
 *   await page.goto('/my-page.html');
 *   const speech = await a11y.press('Tab');
 *   expect(speech).toBe('Submit, button');
 * });
 * ```
 *
 * ## Manual Usage
 *
 * ```typescript
 * import { A11yOracle } from '@a11y-oracle/playwright-plugin';
 * import { test, expect } from '@playwright/test';
 *
 * test('manual setup', async ({ page }) => {
 *   const a11y = new A11yOracle(page);
 *   await a11y.init();
 *   // ... assertions ...
 *   await a11y.dispose();
 * });
 * ```
 *
 * @packageDocumentation
 */

export { A11yOracle } from './lib/a11y-oracle.js';
export { test, expect } from './lib/fixture.js';
export type { A11yOracleFixtures } from './lib/fixture.js';
