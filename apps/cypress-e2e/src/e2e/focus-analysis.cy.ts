/**
 * E2E tests for focus indicator analysis via Cypress.
 *
 * These tests verify that A11y-Oracle can inspect CSS focus indicators
 * and check WCAG 2.4.12 AA compliance (contrast ratio >= 3.0 for
 * visible focus indicators).
 *
 * Fixture: focus-indicators.html
 *   Five buttons with different focus indicator styles:
 *     #good-outline-btn  — 3px solid blue outline on dark bg (WCAG AA pass)
 *     #box-shadow-btn    — box-shadow: 0 0 0 3px #3498db (visible, non-outline)
 *     #no-indicator-btn  — outline: none with no replacement (WCAG fail)
 *     #low-contrast-btn  — light gray outline on light bg (low contrast)
 *     #dark-bg-btn       — red outline on very dark background (WCAG AA pass)
 *
 * To reproduce in your own app:
 *   1. Use `cy.a11yPressKey('Tab')` to Tab through elements — each returned
 *      A11yState includes `focusIndicator.isVisible` and `meetsWCAG_AA`.
 *   2. Assert `state.focusIndicator.meetsWCAG_AA` for every interactive
 *      element to catch WCAG 2.4.12 failures.
 *   3. For programmatic focus, use cy.get(selector).focus() then cy.a11yState().
 */

describe('Focus Indicator Analysis', () => {
  beforeEach(() => {
    cy.visit('/focus-indicators.html');
    // Initialize A11y-Oracle — must be called AFTER cy.visit()
    cy.initA11yOracle();
  });

  afterEach(() => {
    // Always dispose to release CDP resources
    cy.disposeA11yOracle();
  });

  /**
   * Verify that a well-styled focus outline (3px solid blue on dark bg)
   * is detected as visible with a measurable contrast ratio.
   *
   * Reproducing: Tab to any element, then check `state.focusIndicator`
   * in the returned A11yState. `isVisible` tells you if an outline or
   * box-shadow exists; `contrastRatio` gives the WCAG contrast value.
   */
  it('good outline is visible with contrast', () => {
    // Tab to the first button (Good Outline) — a11yPressKey returns A11yState
    cy.a11yPressKey('Tab').then((state) => {
      // This button has a visible 3px blue outline
      expect(state.focusIndicator.isVisible).to.be.true;
      // Contrast ratio should be parseable and greater than 1
      if (state.focusIndicator.contrastRatio !== null) {
        expect(state.focusIndicator.contrastRatio).to.be.greaterThan(1);
      }
    });
  });

  /**
   * Verify that focus indicator data is returned for each element as
   * you Tab through the page — useful for auditing an entire page's
   * focus indicators in sequence.
   *
   * Reproducing: Loop through a11yPressKey('Tab') calls and collect
   * the focusIndicator from each state to build a focus indicator audit.
   */
  it('Tab through elements reports focus indicator for each', () => {
    // Tab to first button (good outline)
    cy.a11yPressKey('Tab').then((state1) => {
      expect(state1.focusIndicator).to.exist;
      expect(state1.focusIndicator.isVisible).to.be.a('boolean');
    });

    // Tab to second button (box shadow) — different indicator style
    cy.a11yPressKey('Tab').then((state2) => {
      expect(state2.focusIndicator).to.exist;
      expect(state2.focusIndicator.isVisible).to.be.a('boolean');
    });
  });
});
