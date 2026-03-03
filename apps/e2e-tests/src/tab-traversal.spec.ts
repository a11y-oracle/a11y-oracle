/**
 * E2E tests for tab order traversal and keyboard trap detection.
 *
 * These tests verify two key WCAG requirements:
 *   - Tab order: all interactive elements are reachable via Tab in a
 *     logical order (WCAG 2.4.3 Focus Order)
 *   - Keyboard traps: focus must not get stuck in any container
 *     (WCAG 2.1.2 No Keyboard Trap)
 *
 * Fixture: keyboard-trap.html
 *   Contains two containers:
 *     #bad-trap  — A keyboard trap: JavaScript intercepts Tab and cycles
 *                  focus between 3 buttons, never allowing escape.
 *     #good-form — A normal form with 2 inputs: Tab exits naturally
 *                  to the "Outside Button" below.
 *   Also has a skip link and an "Outside Button" outside both containers.
 *
 * To reproduce in your own app:
 *   1. Use `a11y.traverseTabOrder()` to extract all tabbable elements
 *      and verify count/order.
 *   2. Use `a11y.traverseSubTree('#container', maxTabs)` to check if
 *      focus can escape a specific container (e.g., modal, dropdown).
 *   3. Assert `result.isTrapped === false` for all containers that
 *      should allow Tab escape.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Tab Order Traversal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/keyboard-trap.html');
  });

  /**
   * Verify that traverseTabOrder() returns all tabbable elements on
   * the page — useful for auditing focus order and finding missing
   * or unexpected tabbable elements.
   *
   * Reproducing: Call `a11y.traverseTabOrder()` on any page. It queries
   * the DOM for all focusable elements (links, buttons, inputs, etc.),
   * filters out hidden/disabled ones, and returns them sorted by tabIndex.
   */
  test('traverseTabOrder returns all tabbable elements', async ({ a11y }) => {
    const report = await a11y.traverseTabOrder();

    // Verify we found tabbable elements and the count matches
    expect(report.totalCount).toBeGreaterThan(0);
    expect(report.entries.length).toBe(report.totalCount);

    // The page has buttons (in trap + outside) and inputs (in form)
    const tags = report.entries.map((e) => e.tag);
    expect(tags).toContain('BUTTON');
    expect(tags).toContain('INPUT');
  });

  /**
   * Verify that each tab order entry has all expected properties:
   * index, tag, tabIndex, and bounding rect.
   *
   * Reproducing: Use these properties to build a visual tab order
   * overlay or to assert that specific elements appear at expected
   * positions in the tab order.
   */
  test('tab order entries have expected properties', async ({ a11y }) => {
    const report = await a11y.traverseTabOrder();
    const first = report.entries[0];

    // Each entry includes position, element info, and bounding rect
    expect(first.index).toBe(0);
    expect(first.tag).toBeDefined();
    expect(typeof first.tabIndex).toBe('number');
    expect(first.rect).toBeDefined();
    expect(typeof first.rect.x).toBe('number');
    expect(typeof first.rect.width).toBe('number');
  });

  /**
   * Verify that a keyboard trap is correctly detected: the #bad-trap
   * container intercepts Tab and cycles focus between its 3 buttons,
   * never allowing focus to escape.
   *
   * Reproducing: Call `a11y.traverseSubTree('#your-container', maxTabs)`
   * where maxTabs is the maximum number of Tab presses before declaring
   * a trap. If `result.isTrapped === true`, focus never escaped — this
   * is a WCAG 2.1.2 failure.
   */
  test('detects keyboard trap in bad container', async ({ a11y, page }) => {
    // Focus the first button inside the trap container
    await page.focus('#trap-btn-1');
    await page.waitForTimeout(50);

    // traverseSubTree focuses the first element inside #bad-trap, then
    // presses Tab up to 10 times checking if focus leaves the container
    const result = await a11y.traverseSubTree('#bad-trap', 10);

    // Focus never escaped — this IS a keyboard trap (WCAG 2.1.2 failure)
    expect(result.isTrapped).toBe(true);
    // All 10 Tab presses were exhausted without escaping
    expect(result.tabCount).toBe(10);
    // Focus visited elements inside the trap
    expect(result.visitedElements.length).toBeGreaterThan(0);
    // No escape element (focus never left the container)
    expect(result.escapeElement).toBeNull();
  });

  /**
   * Verify that a well-behaved container allows focus to escape:
   * the #good-form has 2 inputs, and Tab moves naturally from the
   * last input to the "Outside Button" below.
   *
   * Reproducing: For containers that SHOULD allow escape (forms, card
   * groups, etc.), assert `result.isTrapped === false` and check that
   * `result.escapeElement` identifies where focus went.
   */
  test('detects escape from good container', async ({ a11y, page }) => {
    // Focus the first input in the form
    await page.focus('#name-input');
    await page.waitForTimeout(50);

    // traverseSubTree checks if focus can escape #good-form within 10 Tabs
    const result = await a11y.traverseSubTree('#good-form', 10);

    // Focus DID escape — this is NOT a keyboard trap (WCAG 2.1.2 pass)
    expect(result.isTrapped).toBe(false);
    // escapeElement tells you which element received focus after escaping
    expect(result.escapeElement).not.toBeNull();
    // Some elements inside the form were visited before escaping
    expect(result.visitedElements.length).toBeGreaterThan(0);
  });
});
