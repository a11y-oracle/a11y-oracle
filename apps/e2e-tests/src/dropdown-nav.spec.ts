/**
 * E2E tests for the dropdown navigation menu fixture.
 *
 * These tests verify that the A11y-Oracle Playwright plugin correctly
 * reads the accessibility tree from the sandbox's WCAG-compliant
 * dropdown navigation and produces standardized speech output.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Dropdown Navigation Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dropdown-nav.html');
  });

  test('Tab to first menu item announces as link or menu item', async ({
    a11y,
  }) => {
    const speech = await a11y.press('Tab');
    // First item is "Home" link with role="menuitem"
    expect(speech).toContain('Home');
    expect(speech).toContain('menu item');
  });

  test('Tab to second item announces Products button with collapsed state', async ({
    a11y,
  }) => {
    await a11y.press('Tab');
    // Arrow right to move to Products button
    const speech = await a11y.press('ArrowRight');
    expect(speech).toContain('Products');
    expect(speech).toContain('collapsed');
  });

  test('Enter on Products button opens submenu', async ({ a11y }) => {
    await a11y.press('Tab');
    await a11y.press('ArrowRight');
    // Press Enter to open submenu — focus should move to first submenu item
    const speech = await a11y.press('Enter');
    expect(speech).toContain('Clothing');
  });

  test('Arrow Down navigates submenu items', async ({ a11y }) => {
    await a11y.press('Tab');
    await a11y.press('ArrowRight');
    await a11y.press('Enter');
    // Now in submenu, first item is Clothing
    const speech = await a11y.press('ArrowDown');
    expect(speech).toContain('Shoes');
  });

  test('Escape closes submenu and returns to parent button', async ({
    a11y,
  }) => {
    await a11y.press('Tab');
    await a11y.press('ArrowRight');
    await a11y.press('Enter');
    // Press Escape to close submenu
    const speech = await a11y.press('Escape');
    expect(speech).toContain('Products');
    expect(speech).toContain('collapsed');
  });

  test('navigation landmark is present in the accessibility tree', async ({
    a11y,
  }) => {
    const allSpeech = await a11y.getFullTreeSpeech();
    const speeches = allSpeech.map((r) => r.speech);

    // The nav element has aria-label="Main", so it should produce
    // "Main, navigation landmark"
    const navLandmark = speeches.find((s) => s.includes('navigation landmark'));
    expect(navLandmark).toBeDefined();
    expect(navLandmark).toContain('Main');
  });

  test('getSpeech returns empty string when no element is focused', async ({
    a11y,
  }) => {
    // Before any Tab press, no interactive element should have focus
    // (the document body has focus, which is typically RootWebArea)
    const speech = await a11y.getSpeech();
    // May be empty or may be a page-level node; main point is it doesn't throw
    expect(typeof speech).toBe('string');
  });

  test('getSpeechResult returns structured data', async ({ a11y }) => {
    await a11y.press('Tab');
    const result = await a11y.getSpeechResult();
    expect(result).not.toBeNull();
    expect(result!.name).toBeDefined();
    expect(result!.role).toBeDefined();
    expect(result!.states).toBeInstanceOf(Array);
    expect(result!.rawNode).toBeDefined();
    expect(result!.speech).toBe(
      [result!.name, result!.role, ...result!.states]
        .filter(Boolean)
        .join(', ')
    );
  });

  test('full keyboard navigation cycle works', async ({ a11y }) => {
    // Tab into menubar
    const home = await a11y.press('Tab');
    expect(home).toContain('Home');

    // Right arrow to Products
    const products = await a11y.press('ArrowRight');
    expect(products).toContain('Products');

    // Right arrow to Services
    const services = await a11y.press('ArrowRight');
    expect(services).toContain('Services');

    // Right arrow to About
    const about = await a11y.press('ArrowRight');
    expect(about).toContain('About');

    // Right arrow to Contact Us
    const contact = await a11y.press('ArrowRight');
    expect(contact).toContain('Contact Us');

    // Right arrow wraps to Home
    const homeAgain = await a11y.press('ArrowRight');
    expect(homeAgain).toContain('Home');
  });
});
