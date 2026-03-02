/**
 * E2E tests for the unified A11yState API via Cypress.
 *
 * Verifies that a11yPressKey() returns a complete A11yState snapshot
 * with speech, focused element info, and focus indicator data.
 */

describe('Unified A11yState', () => {
  beforeEach(() => {
    cy.visit('/dropdown-nav.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('a11yPressKey returns A11yState with speech', () => {
    cy.a11yPressKey('Tab').then((state) => {
      expect(state).to.exist;
      expect(state.speech).to.contain('Home');
      expect(state.speechResult).to.not.be.null;
      expect(state.speechResult?.name).to.exist;
      expect(state.speechResult?.role).to.exist;
    });
  });

  it('a11yPressKey returns focused element info', () => {
    cy.a11yPressKey('Tab').then((state) => {
      expect(state.focusedElement).to.not.be.null;
      expect(state.focusedElement?.tag).to.exist;
      expect(state.focusedElement?.tabIndex).to.be.a('number');
      expect(state.focusedElement?.rect).to.exist;
    });
  });

  it('a11yPressKey returns focus indicator analysis', () => {
    cy.a11yPressKey('Tab').then((state) => {
      expect(state.focusIndicator).to.exist;
      expect(state.focusIndicator.isVisible).to.be.a('boolean');
      expect(state.focusIndicator.meetsWCAG_AA).to.be.a('boolean');
    });
  });

  it('a11yState returns state without key press', () => {
    // Press Tab first to focus an element
    cy.a11yPress('Tab');
    cy.a11yState().then((state) => {
      expect(state.speech).to.contain('Home');
      expect(state.focusedElement).to.not.be.null;
    });
  });

  it('sequential a11yPressKey calls update state', () => {
    cy.a11yPressKey('Tab').then((state1) => {
      expect(state1.speech).to.contain('Home');

      cy.a11yPressKey('ArrowRight').then((state2) => {
        expect(state2.speech).to.contain('Products');
      });
    });
  });
});
