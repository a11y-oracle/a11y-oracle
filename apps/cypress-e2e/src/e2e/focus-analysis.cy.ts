/**
 * E2E tests for focus indicator analysis via Cypress.
 *
 * Uses the focus-indicators.html sandbox fixture to verify
 * CSS analysis of focus indicators and WCAG 2.4.12 compliance.
 */

describe('Focus Indicator Analysis', () => {
  beforeEach(() => {
    cy.visit('/focus-indicators.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('good outline is visible with contrast', () => {
    // Tab to the "Good Outline" button (first tabbable element)
    cy.a11yPressKey('Tab').then((state) => {
      expect(state.focusIndicator.isVisible).to.be.true;
      if (state.focusIndicator.contrastRatio !== null) {
        expect(state.focusIndicator.contrastRatio).to.be.greaterThan(1);
      }
    });
  });

  it('Tab through elements reports focus indicator for each', () => {
    // Tab to first button
    cy.a11yPressKey('Tab').then((state1) => {
      expect(state1.focusIndicator).to.exist;
      expect(state1.focusIndicator.isVisible).to.be.a('boolean');
    });

    // Tab to second button
    cy.a11yPressKey('Tab').then((state2) => {
      expect(state2.focusIndicator).to.exist;
      expect(state2.focusIndicator.isVisible).to.be.a('boolean');
    });
  });
});
