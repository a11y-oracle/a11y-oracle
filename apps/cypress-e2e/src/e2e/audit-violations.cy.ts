/**
 * E2E tests for audit rule detection via Cypress on the violations fixture.
 *
 * Fixture: a11y-violations.html
 *   Five elements with intentional violations:
 *     #icon-btn         — empty aria-label → oracle/focus-missing-name
 *     #generic-div      — div[tabindex=0] with no role → oracle/focus-generic-role
 *     #positive-tab     — button with tabindex="5" → oracle/positive-tabindex
 *     #no-indicator-btn — outline:none → oracle/focus-not-visible
 *     #good-btn         — clean button (no violations)
 */

describe('Audit Violations Fixture', () => {
  beforeEach(() => {
    cy.visit('/a11y-violations.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('#no-indicator-btn has focusIndicator.isVisible === false', () => {
    // Focus the button that has outline:none
    cy.get('#no-indicator-btn').focus();
    cy.a11yState().then((state) => {
      expect(state.focusIndicator.isVisible).to.be.false;
    });
  });

  it('#positive-tab has tabIndex > 0', () => {
    cy.get('#positive-tab').focus();
    cy.a11yState().then((state) => {
      expect(state.focusedElement).to.not.be.null;
      expect(state.focusedElement!.tabIndex).to.be.greaterThan(0);
    });
  });

  it('#good-btn passes all checks', () => {
    cy.get('#good-btn').focus();
    cy.a11yState().then((state) => {
      expect(state.focusIndicator.isVisible).to.be.true;
      expect(state.focusedElement).to.not.be.null;
      expect(state.focusedElement!.tabIndex).to.be.lessThan(1);
    });
  });
});
