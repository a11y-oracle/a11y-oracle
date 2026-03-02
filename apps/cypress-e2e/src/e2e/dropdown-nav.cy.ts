/**
 * E2E tests for the dropdown navigation menu fixture.
 *
 * These tests verify that the A11y-Oracle Cypress plugin correctly
 * reads the accessibility tree from the sandbox's WCAG-compliant
 * dropdown navigation and produces standardized speech output.
 *
 * Feature parity with the Playwright E2E suite.
 */

describe('Dropdown Navigation Menu', () => {
  beforeEach(() => {
    cy.visit('/dropdown-nav.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('Tab to first menu item announces as menu item', () => {
    cy.a11yPress('Tab').should('contain', 'Home').and('contain', 'menu item');
  });

  it('Tab to second item announces Products button with collapsed state', () => {
    cy.a11yPress('Tab');
    // Arrow right to move to Products button
    cy.a11yPress('ArrowRight')
      .should('contain', 'Products')
      .and('contain', 'collapsed');
  });

  it('Enter on Products button opens submenu', () => {
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    // Press Enter to open submenu — focus should move to first submenu item
    cy.a11yPress('Enter').should('contain', 'Clothing');
  });

  it('Arrow Down navigates submenu items', () => {
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    cy.a11yPress('Enter');
    // Now in submenu, first item is Clothing — arrow down to Shoes
    cy.a11yPress('ArrowDown').should('contain', 'Shoes');
  });

  it('Escape closes submenu and returns to parent button', () => {
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    cy.a11yPress('Enter');
    // Press Escape to close submenu
    cy.a11yPress('Escape')
      .should('contain', 'Products')
      .and('contain', 'collapsed');
  });

  it('navigation landmark is present in the accessibility tree', () => {
    cy.getA11yFullTreeSpeech().then((allSpeech) => {
      const speeches = allSpeech.map((r) => r.speech);
      const navLandmark = speeches.find((s) =>
        s.includes('navigation landmark')
      );
      expect(navLandmark).to.exist;
      expect(navLandmark).to.contain('Main');
    });
  });

  it('getA11ySpeech returns a string when no element is focused', () => {
    // Before any Tab press, no interactive element should have focus
    cy.getA11ySpeech().should('be.a', 'string');
  });

  it('getA11ySpeechResult returns structured data', () => {
    cy.a11yPress('Tab');
    cy.getA11ySpeechResult().then((result) => {
      expect(result).to.not.be.null;
      expect(result!.name).to.exist;
      expect(result!.role).to.exist;
      expect(result!.states).to.be.an('array');
      expect(result!.rawNode).to.exist;
      expect(result!.speech).to.equal(
        [result!.name, result!.role, ...result!.states]
          .filter(Boolean)
          .join(', ')
      );
    });
  });

  it('full keyboard navigation cycle works', () => {
    // Tab into menubar
    cy.a11yPress('Tab').should('contain', 'Home');
    // Right arrow to Products
    cy.a11yPress('ArrowRight').should('contain', 'Products');
    // Right arrow to Services
    cy.a11yPress('ArrowRight').should('contain', 'Services');
    // Right arrow to About
    cy.a11yPress('ArrowRight').should('contain', 'About');
    // Right arrow to Contact Us
    cy.a11yPress('ArrowRight').should('contain', 'Contact Us');
    // Right arrow wraps to Home
    cy.a11yPress('ArrowRight').should('contain', 'Home');
  });
});
