/**
 * E2E tests for tab order traversal and keyboard trap detection.
 *
 * Uses the keyboard-trap.html sandbox fixture to verify tab order
 * extraction and WCAG 2.1.2 keyboard trap detection.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Tab Order Traversal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/keyboard-trap.html');
  });

  test('traverseTabOrder returns all tabbable elements', async ({ a11y }) => {
    const report = await a11y.traverseTabOrder();

    expect(report.totalCount).toBeGreaterThan(0);
    expect(report.entries.length).toBe(report.totalCount);

    // Should include buttons, inputs, and the skip link
    const tags = report.entries.map((e) => e.tag);
    expect(tags).toContain('BUTTON');
    expect(tags).toContain('INPUT');
  });

  test('tab order entries have expected properties', async ({ a11y }) => {
    const report = await a11y.traverseTabOrder();
    const first = report.entries[0];

    expect(first.index).toBe(0);
    expect(first.tag).toBeDefined();
    expect(typeof first.tabIndex).toBe('number');
    expect(first.rect).toBeDefined();
    expect(typeof first.rect.x).toBe('number');
    expect(typeof first.rect.width).toBe('number');
  });

  test('detects keyboard trap in bad container', async ({ a11y, page }) => {
    // Focus the first button inside the trap
    await page.focus('#trap-btn-1');
    await page.waitForTimeout(50);

    const result = await a11y.traverseSubTree('#bad-trap', 10);

    expect(result.isTrapped).toBe(true);
    expect(result.tabCount).toBe(10);
    expect(result.visitedElements.length).toBeGreaterThan(0);
    expect(result.escapeElement).toBeNull();
  });

  test('detects escape from good container', async ({ a11y, page }) => {
    // Focus the first input in the good form
    await page.focus('#name-input');
    await page.waitForTimeout(50);

    const result = await a11y.traverseSubTree('#good-form', 10);

    expect(result.isTrapped).toBe(false);
    expect(result.escapeElement).not.toBeNull();
    expect(result.visitedElements.length).toBeGreaterThan(0);
  });
});
