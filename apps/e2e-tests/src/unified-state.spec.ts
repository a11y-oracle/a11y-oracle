/**
 * E2E tests for the unified A11yState API.
 *
 * Verifies that pressKey() returns a complete A11yState snapshot
 * with speech, focused element info, and focus indicator data.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Unified A11yState', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dropdown-nav.html');
  });

  test('pressKey returns A11yState with speech', async ({ a11y }) => {
    const state = await a11y.pressKey('Tab');

    expect(state).toBeDefined();
    expect(state.speech).toContain('Home');
    expect(state.speechResult).not.toBeNull();
    expect(state.speechResult?.name).toBeDefined();
    expect(state.speechResult?.role).toBeDefined();
  });

  test('pressKey returns focused element info', async ({ a11y }) => {
    const state = await a11y.pressKey('Tab');

    expect(state.focusedElement).not.toBeNull();
    expect(state.focusedElement?.tag).toBeDefined();
    expect(typeof state.focusedElement?.tabIndex).toBe('number');
    expect(state.focusedElement?.rect).toBeDefined();
  });

  test('pressKey returns focus indicator analysis', async ({ a11y }) => {
    const state = await a11y.pressKey('Tab');

    expect(state.focusIndicator).toBeDefined();
    expect(typeof state.focusIndicator.isVisible).toBe('boolean');
    expect(typeof state.focusIndicator.meetsWCAG_AA).toBe('boolean');
    // contrastRatio may be null or number
    if (state.focusIndicator.contrastRatio !== null) {
      expect(typeof state.focusIndicator.contrastRatio).toBe('number');
    }
  });

  test('getA11yState returns state without key press', async ({ a11y, page }) => {
    // Focus an element first
    await page.focus('a[role="menuitem"]');
    await page.waitForTimeout(50);

    const state = await a11y.getA11yState();

    expect(state.speech).toContain('Home');
    expect(state.focusedElement).not.toBeNull();
  });

  test('pressKey with modifiers dispatches Shift+Tab', async ({
    a11y,
    page,
  }) => {
    // Use focus-indicators page — simple buttons without keyboard traps
    await page.goto('/focus-indicators.html');

    // Tab forward to first button, then to second
    const state1 = await a11y.pressKey('Tab');
    expect(state1.focusedElement).not.toBeNull();
    const firstId = state1.focusedElement?.id ?? '';

    const state2 = await a11y.pressKey('Tab');
    expect(state2.focusedElement).not.toBeNull();
    expect(state2.focusedElement?.id).not.toBe(firstId);

    // Shift+Tab backward — should return to first button
    const state3 = await a11y.pressKey('Tab', { shift: true });
    expect(state3.focusedElement).not.toBeNull();
    expect(state3.focusedElement?.id).toBe(firstId);
  });

  test('sequential pressKey calls update state', async ({ a11y }) => {
    const state1 = await a11y.pressKey('Tab');
    expect(state1.speech).toContain('Home');

    const state2 = await a11y.pressKey('ArrowRight');
    expect(state2.speech).toContain('Products');

    // Different focused elements
    expect(state1.focusedElement?.textContent).not.toBe(
      state2.focusedElement?.textContent
    );
  });
});
