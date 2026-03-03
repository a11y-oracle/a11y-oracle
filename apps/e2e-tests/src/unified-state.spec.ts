/**
 * E2E tests for the unified A11yState API.
 *
 * The `pressKey()` method is the primary way to test keyboard accessibility.
 * Unlike `press()` (which returns just a speech string), `pressKey()` returns
 * a complete A11yState snapshot with three dimensions:
 *   - speech / speechResult: what a screen reader would announce
 *   - focusedElement: DOM info about where focus landed (tag, id, rect, etc.)
 *   - focusIndicator: CSS analysis of the visual focus indicator
 *
 * Fixture: dropdown-nav.html (for most tests) and focus-indicators.html
 *   (for Shift+Tab test — simple buttons without keyboard trap interference).
 *
 * To reproduce in your own app:
 *   1. Use `a11y.pressKey('Tab')` instead of `a11y.press('Tab')` to get
 *      the full A11yState.
 *   2. Assert on `state.speech` for screen reader output.
 *   3. Assert on `state.focusedElement?.tag` / `?.id` for DOM-level checks.
 *   4. Assert on `state.focusIndicator.meetsWCAG_AA` for visual indicator
 *      compliance.
 *   5. Use `a11y.getA11yState()` to read the current state without pressing
 *      any key (e.g., after programmatic focus).
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Unified A11yState', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dropdown-nav.html');
  });

  /**
   * Verify that pressKey('Tab') returns the full A11yState with speech
   * output and a structured SpeechResult.
   *
   * Reproducing: `state.speech` is the same string you'd get from
   * `press('Tab')`. `state.speechResult` adds the raw AXNode for
   * advanced inspection.
   */
  test('pressKey returns A11yState with speech', async ({ a11y }) => {
    // pressKey dispatches a native CDP key event and returns full state
    const state = await a11y.pressKey('Tab');

    // speech is the string output (e.g., "Home, menu item")
    expect(state).toBeDefined();
    expect(state.speech).toContain('Home');
    // speechResult has the structured breakdown: name, role, states, rawNode
    expect(state.speechResult).not.toBeNull();
    expect(state.speechResult?.name).toBeDefined();
    expect(state.speechResult?.role).toBeDefined();
  });

  /**
   * Verify that pressKey returns DOM-level info about the focused element:
   * tag name, tabIndex, and bounding rectangle.
   *
   * Reproducing: Use `state.focusedElement` to assert that focus landed
   * on the correct DOM element — useful when speech alone isn't enough
   * (e.g., verifying the right element among identically-named ones).
   */
  test('pressKey returns focused element info', async ({ a11y }) => {
    const state = await a11y.pressKey('Tab');

    // focusedElement gives DOM info from document.activeElement
    expect(state.focusedElement).not.toBeNull();
    expect(state.focusedElement?.tag).toBeDefined();
    expect(typeof state.focusedElement?.tabIndex).toBe('number');
    // rect gives bounding box for visual regression or layout assertions
    expect(state.focusedElement?.rect).toBeDefined();
  });

  /**
   * Verify that pressKey returns focus indicator analysis for WCAG 2.4.12.
   *
   * Reproducing: Check `state.focusIndicator.isVisible` to confirm a
   * visual focus indicator exists. Check `meetsWCAG_AA` for contrast
   * compliance. `contrastRatio` may be null if colors can't be parsed.
   */
  test('pressKey returns focus indicator analysis', async ({ a11y }) => {
    const state = await a11y.pressKey('Tab');

    expect(state.focusIndicator).toBeDefined();
    // isVisible: whether any outline or box-shadow focus indicator exists
    expect(typeof state.focusIndicator.isVisible).toBe('boolean');
    // meetsWCAG_AA: true if visible AND contrast ratio >= 3.0
    expect(typeof state.focusIndicator.meetsWCAG_AA).toBe('boolean');
    // contrastRatio: number if parseable, null if colors are complex
    if (state.focusIndicator.contrastRatio !== null) {
      expect(typeof state.focusIndicator.contrastRatio).toBe('number');
    }
  });

  /**
   * Verify that getA11yState() reads the current state WITHOUT pressing
   * a key — useful after programmatic focus via page.focus() or click.
   *
   * Reproducing: Focus an element via page.focus() or user interaction,
   * then call `a11y.getA11yState()` to inspect the current state.
   */
  test('getA11yState returns state without key press', async ({ a11y, page }) => {
    // Programmatically focus the first menu item
    await page.focus('a[role="menuitem"]');
    await page.waitForTimeout(50);

    // getA11yState() reads current state — no key press needed
    const state = await a11y.getA11yState();

    expect(state.speech).toContain('Home');
    expect(state.focusedElement).not.toBeNull();
  });

  /**
   * Verify that pressKey supports modifier keys, e.g., Shift+Tab for
   * backward navigation.
   *
   * Reproducing: Pass a ModifierKeys object as the second argument:
   *   `a11y.pressKey('Tab', { shift: true })` — Shift+Tab (backward)
   *   `a11y.pressKey('a', { ctrl: true })`    — Ctrl+A (select all)
   * This test uses focus-indicators.html (simple buttons) to avoid the
   * keyboard trap in keyboard-trap.html which intercepts Tab.
   */
  test('pressKey with modifiers dispatches Shift+Tab', async ({
    a11y,
    page,
  }) => {
    // Switch to focus-indicators.html — simple buttons without traps
    await page.goto('/focus-indicators.html');

    // Tab forward: focus lands on the first button
    const state1 = await a11y.pressKey('Tab');
    expect(state1.focusedElement).not.toBeNull();
    const firstId = state1.focusedElement?.id ?? '';

    // Tab forward again: focus moves to the second button
    const state2 = await a11y.pressKey('Tab');
    expect(state2.focusedElement).not.toBeNull();
    expect(state2.focusedElement?.id).not.toBe(firstId);

    // Shift+Tab: focus moves backward — should return to the first button
    const state3 = await a11y.pressKey('Tab', { shift: true });
    expect(state3.focusedElement).not.toBeNull();
    expect(state3.focusedElement?.id).toBe(firstId);
  });

  /**
   * Verify that sequential pressKey calls update the state as focus moves.
   *
   * Reproducing: Each pressKey call returns a fresh A11yState snapshot
   * reflecting the newly focused element. Compare consecutive states to
   * verify focus movement.
   */
  test('sequential pressKey calls update state', async ({ a11y }) => {
    // First Tab → Home
    const state1 = await a11y.pressKey('Tab');
    expect(state1.speech).toContain('Home');

    // ArrowRight → Products
    const state2 = await a11y.pressKey('ArrowRight');
    expect(state2.speech).toContain('Products');

    // Focus moved to a different element
    expect(state1.focusedElement?.textContent).not.toBe(
      state2.focusedElement?.textContent
    );
  });
});
