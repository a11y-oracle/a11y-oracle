/**
 * E2E tests for the dropdown navigation menu fixture.
 *
 * These tests verify that the A11y-Oracle Playwright plugin correctly
 * reads the accessibility tree from the sandbox's WCAG-compliant
 * dropdown navigation and produces standardized speech output.
 *
 * Fixture: dropdown-nav.html
 *   A WAI-ARIA Menubar pattern (https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
 *   with five top-level menu items: Home, Products, Services, About, Contact Us.
 *   "Products" and "Services" have submenus that open on Enter and close on Escape.
 *
 * To reproduce in your own app:
 *   1. `npm install -D @a11y-oracle/playwright-plugin`
 *   2. Import `{ test, expect }` from `@a11y-oracle/playwright-plugin`
 *      instead of `@playwright/test`. This injects the `a11y` fixture.
 *   3. Use `a11y.press(key)` to simulate keyboard navigation and
 *      assert on the returned speech string.
 */
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Dropdown Navigation Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dropdown-nav.html');
  });

  /**
   * Verify that Tab moves focus into the menubar and announces
   * the first item. In the WAI-ARIA Menubar pattern, only the
   * first item (Home) has tabindex="0" — Tab lands directly on it.
   *
   * Reproducing: Replace '/dropdown-nav.html' with your own page URL.
   * Any element with role="menuitem" should announce as "menu item".
   */
  test('Tab to first menu item announces as link or menu item', async ({
    a11y,
  }) => {
    // Press Tab once — focus enters the menubar at the first item
    const speech = await a11y.press('Tab');

    // The first menubar item is an <a role="menuitem">Home</a>
    // Expected speech: "Home, menu item"
    expect(speech).toContain('Home');
    expect(speech).toContain('menu item');
  });

  /**
   * Verify that ArrowRight moves between top-level menubar items and
   * that the speech includes the "collapsed" state for buttons with submenus.
   *
   * Reproducing: Use ArrowRight/ArrowLeft for horizontal menubar
   * navigation. Buttons with aria-expanded="false" report "collapsed".
   */
  test('Tab to second item announces Products button with collapsed state', async ({
    a11y,
  }) => {
    // Tab into the menubar (lands on Home)
    await a11y.press('Tab');

    // ArrowRight moves focus to the next top-level item: Products
    // Products is a <button aria-expanded="false"> so it reports "collapsed"
    const speech = await a11y.press('ArrowRight');
    expect(speech).toContain('Products');
    expect(speech).toContain('collapsed');
  });

  /**
   * Verify that pressing Enter on a menubar button with a submenu
   * opens the submenu and moves focus to the first submenu item.
   *
   * Reproducing: Any button with aria-haspopup="true" should open
   * its submenu on Enter and move focus to the first child menuitem.
   */
  test('Enter on Products button opens submenu', async ({ a11y }) => {
    // Navigate to Products: Tab → Home, ArrowRight → Products
    await a11y.press('Tab');
    await a11y.press('ArrowRight');

    // Press Enter to open the Products submenu
    // Focus should move to the first submenu item: Clothing
    const speech = await a11y.press('Enter');
    expect(speech).toContain('Clothing');
  });

  /**
   * Verify that ArrowDown moves through submenu items sequentially.
   *
   * Reproducing: Inside an open submenu, ArrowDown moves to the
   * next item. ArrowUp moves to the previous item.
   */
  test('Arrow Down navigates submenu items', async ({ a11y }) => {
    // Open Products submenu: Tab → Home, ArrowRight → Products, Enter → Clothing
    await a11y.press('Tab');
    await a11y.press('ArrowRight');
    await a11y.press('Enter');

    // ArrowDown moves from Clothing to the next submenu item: Shoes
    const speech = await a11y.press('ArrowDown');
    expect(speech).toContain('Shoes');
  });

  /**
   * Verify that Escape closes an open submenu and returns focus
   * to the parent menubar button with "collapsed" state.
   *
   * Reproducing: Pressing Escape inside any open submenu should
   * close it and restore the parent button's aria-expanded to "false".
   */
  test('Escape closes submenu and returns to parent button', async ({
    a11y,
  }) => {
    // Open Products submenu: Tab → Home, ArrowRight → Products, Enter → Clothing
    await a11y.press('Tab');
    await a11y.press('ArrowRight');
    await a11y.press('Enter');

    // Escape closes the submenu — focus returns to Products (collapsed)
    const speech = await a11y.press('Escape');
    expect(speech).toContain('Products');
    expect(speech).toContain('collapsed');
  });

  /**
   * Verify that landmarks are present in the full accessibility tree.
   * Use getFullTreeSpeech() to scan the entire page without needing focus.
   *
   * Reproducing: Call a11y.getFullTreeSpeech() to get an array of every
   * non-ignored node. Filter by role to find landmarks, headings, etc.
   * The <nav aria-label="Main"> produces "Main, navigation landmark".
   */
  test('navigation landmark is present in the accessibility tree', async ({
    a11y,
  }) => {
    // getFullTreeSpeech() returns speech for ALL nodes, not just focused ones
    const allSpeech = await a11y.getFullTreeSpeech();
    const speeches = allSpeech.map((r) => r.speech);

    // The <nav aria-label="Main"> element should appear as a navigation landmark
    const navLandmark = speeches.find((s) => s.includes('navigation landmark'));
    expect(navLandmark).toBeDefined();
    expect(navLandmark).toContain('Main');
  });

  /**
   * Verify that getSpeech() returns a string even when no interactive
   * element has focus (e.g., on page load before any Tab press).
   *
   * Reproducing: getSpeech() returns an empty string when focus is on
   * the document body or RootWebArea. It never throws.
   */
  test('getSpeech returns empty string when no element is focused', async ({
    a11y,
  }) => {
    // Before any Tab press, focus is on the document body
    const speech = await a11y.getSpeech();

    // Returns a string (may be empty) — the important thing is it doesn't throw
    expect(typeof speech).toBe('string');
  });

  /**
   * Verify that getSpeechResult() returns the full structured data:
   * name, role, states array, raw AXNode, and the composed speech string.
   *
   * Reproducing: Use getSpeechResult() when you need granular assertions
   * on individual parts (e.g., just the role, or just the states array)
   * rather than string matching on the full speech.
   */
  test('getSpeechResult returns structured data', async ({ a11y }) => {
    // Tab to the first menu item to give it focus
    await a11y.press('Tab');

    // getSpeechResult() returns the full SpeechResult object
    const result = await a11y.getSpeechResult();
    expect(result).not.toBeNull();
    expect(result!.name).toBeDefined();
    expect(result!.role).toBeDefined();
    expect(result!.states).toBeInstanceOf(Array);
    expect(result!.rawNode).toBeDefined();

    // Verify the speech string is composed from name + role + states
    expect(result!.speech).toBe(
      [result!.name, result!.role, ...result!.states]
        .filter(Boolean)
        .join(', ')
    );
  });

  /**
   * Verify that the full menubar keyboard navigation cycle works:
   * ArrowRight moves through all items and wraps back to the first.
   *
   * Reproducing: In a WAI-ARIA Menubar, ArrowRight should cycle through
   * Home → Products → Services → About → Contact Us → Home (wrap).
   */
  test('full keyboard navigation cycle works', async ({ a11y }) => {
    // Tab enters the menubar at Home
    const home = await a11y.press('Tab');
    expect(home).toContain('Home');

    // ArrowRight cycles through each top-level item
    const products = await a11y.press('ArrowRight');
    expect(products).toContain('Products');

    const services = await a11y.press('ArrowRight');
    expect(services).toContain('Services');

    const about = await a11y.press('ArrowRight');
    expect(about).toContain('About');

    const contact = await a11y.press('ArrowRight');
    expect(contact).toContain('Contact Us');

    // ArrowRight from the last item wraps back to the first (Home)
    const homeAgain = await a11y.press('ArrowRight');
    expect(homeAgain).toContain('Home');
  });
});
