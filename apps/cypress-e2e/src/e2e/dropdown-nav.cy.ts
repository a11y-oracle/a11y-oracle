/**
 * E2E tests for the dropdown navigation menu fixture (Cypress).
 *
 * These tests verify that the A11y-Oracle Cypress plugin correctly
 * reads the accessibility tree from the sandbox's WCAG-compliant
 * dropdown navigation and produces standardized speech output.
 * Feature parity with the Playwright E2E suite.
 *
 * Fixture: dropdown-nav.html
 *   A WAI-ARIA Menubar pattern (https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
 *   with five top-level menu items: Home, Products, Services, About, Contact Us.
 *   "Products" and "Services" have submenus that open on Enter and close on Escape.
 *
 * To reproduce in your own app:
 *   1. `npm install -D @a11y-oracle/cypress-plugin`
 *   2. Add `import '@a11y-oracle/cypress-plugin'` to cypress/support/e2e.ts.
 *   3. Call `cy.initA11yOracle()` in beforeEach (after cy.visit) and
 *      `cy.disposeA11yOracle()` in afterEach.
 *   4. Use `cy.a11yPress(key)` to simulate keyboard navigation and
 *      chain `.should()` assertions on the returned speech string.
 */

describe('Dropdown Navigation Menu', () => {
  beforeEach(() => {
    cy.visit('/dropdown-nav.html');
    // Initialize A11y-Oracle — must be called AFTER cy.visit()
    cy.initA11yOracle();
  });

  afterEach(() => {
    // Always dispose to release CDP resources
    cy.disposeA11yOracle();
  });

  /**
   * Verify that Tab moves focus into the menubar and announces
   * the first item. The menubar's first item (Home) has tabindex="0"
   * so it receives focus on the first Tab press.
   *
   * Reproducing: Replace '/dropdown-nav.html' with your own page URL.
   * Chain .should('contain', 'expected text') for assertion.
   */
  it('Tab to first menu item announces as menu item', () => {
    // Press Tab — focus enters the menubar at the first item (Home)
    // Expected speech: "Home, menu item"
    cy.a11yPress('Tab').should('contain', 'Home').and('contain', 'menu item');
  });

  /**
   * Verify that ArrowRight moves between top-level items and that
   * buttons with submenus report their expanded/collapsed state.
   *
   * Reproducing: Products has aria-expanded="false", so the speech
   * includes "collapsed". After opening, it would say "expanded".
   */
  it('Tab to second item announces Products button with collapsed state', () => {
    // Tab into menubar (Home)
    cy.a11yPress('Tab');
    // ArrowRight moves to the next top-level item: Products
    // Products is a button with aria-expanded="false" → "collapsed"
    cy.a11yPress('ArrowRight')
      .should('contain', 'Products')
      .and('contain', 'collapsed');
  });

  /**
   * Verify that Enter on a menubar button with a submenu opens it
   * and moves focus to the first submenu item.
   *
   * Reproducing: Any button with aria-haspopup="true" should open
   * its submenu on Enter.
   */
  it('Enter on Products button opens submenu', () => {
    // Navigate to Products: Tab → Home, ArrowRight → Products
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    // Enter opens the submenu — focus moves to first item (Clothing)
    cy.a11yPress('Enter').should('contain', 'Clothing');
  });

  /**
   * Verify that ArrowDown moves through submenu items sequentially.
   *
   * Reproducing: Inside an open submenu, ArrowDown moves to the next
   * item. The submenu items are: Clothing → Shoes → Accessories.
   */
  it('Arrow Down navigates submenu items', () => {
    // Open Products submenu: Tab → ArrowRight → Enter (now on Clothing)
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    cy.a11yPress('Enter');
    // ArrowDown moves from Clothing to Shoes
    cy.a11yPress('ArrowDown').should('contain', 'Shoes');
  });

  /**
   * Verify that Escape closes an open submenu and returns focus to
   * the parent button with "collapsed" state restored.
   *
   * Reproducing: Pressing Escape inside any open submenu should close
   * it and return focus to the parent menubar button.
   */
  it('Escape closes submenu and returns to parent button', () => {
    // Open Products submenu: Tab → ArrowRight → Enter
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    cy.a11yPress('Enter');
    // Escape closes the submenu — focus returns to Products (collapsed)
    cy.a11yPress('Escape')
      .should('contain', 'Products')
      .and('contain', 'collapsed');
  });

  /**
   * Verify that landmarks are present in the full accessibility tree.
   *
   * Reproducing: Use cy.getA11yFullTreeSpeech() to scan the entire page
   * without needing focus. Filter the results to find landmarks, headings,
   * or any structural elements.
   */
  it('navigation landmark is present in the accessibility tree', () => {
    // getA11yFullTreeSpeech() returns speech for ALL nodes on the page
    cy.getA11yFullTreeSpeech().then((allSpeech) => {
      const speeches = allSpeech.map((r) => r.speech);
      // <nav aria-label="Main"> → "Main, navigation landmark"
      const navLandmark = speeches.find((s) =>
        s.includes('navigation landmark')
      );
      expect(navLandmark).to.exist;
      expect(navLandmark).to.contain('Main');
    });
  });

  /**
   * Verify that getA11ySpeech() returns a string even before any Tab press.
   *
   * Reproducing: getA11ySpeech() returns an empty string when focus is on
   * the document body. It never throws — safe to call at any time.
   */
  it('getA11ySpeech returns a string when no element is focused', () => {
    // Before any Tab, focus is on the document body
    cy.getA11ySpeech().should('be.a', 'string');
  });

  /**
   * Verify that getA11ySpeechResult() returns the full structured data.
   *
   * Reproducing: Use getA11ySpeechResult() when you need granular
   * assertions on name, role, states, or the raw AXNode — rather than
   * string matching on the full speech.
   */
  it('getA11ySpeechResult returns structured data', () => {
    // Tab to first menu item to give it focus
    cy.a11yPress('Tab');
    // getA11ySpeechResult() returns the full SpeechResult object
    cy.getA11ySpeechResult().then((result) => {
      expect(result).to.not.be.null;
      expect(result!.name).to.exist;
      expect(result!.role).to.exist;
      expect(result!.states).to.be.an('array');
      expect(result!.rawNode).to.exist;
      // Verify speech is composed from name + role + states
      expect(result!.speech).to.equal(
        [result!.name, result!.role, ...result!.states]
          .filter(Boolean)
          .join(', ')
      );
    });
  });

  /**
   * Verify the full menubar keyboard navigation cycle: ArrowRight
   * moves through all items and wraps back to the first.
   *
   * Reproducing: In a WAI-ARIA Menubar, ArrowRight should cycle:
   * Home → Products → Services → About → Contact Us → Home (wrap).
   */
  it('full keyboard navigation cycle works', () => {
    // Tab enters the menubar at Home
    cy.a11yPress('Tab').should('contain', 'Home');
    // ArrowRight cycles through each top-level item
    cy.a11yPress('ArrowRight').should('contain', 'Products');
    cy.a11yPress('ArrowRight').should('contain', 'Services');
    cy.a11yPress('ArrowRight').should('contain', 'About');
    cy.a11yPress('ArrowRight').should('contain', 'Contact Us');
    // ArrowRight from the last item wraps back to Home
    cy.a11yPress('ArrowRight').should('contain', 'Home');
  });
});
