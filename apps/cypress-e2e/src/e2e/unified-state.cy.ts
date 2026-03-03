/**
 * E2E tests for the unified A11yState API via Cypress.
 *
 * The `a11yPressKey()` command is the primary way to test keyboard
 * accessibility in Cypress. Unlike `a11yPress()` (which yields just a
 * speech string), `a11yPressKey()` yields a complete A11yState snapshot:
 *   - speech / speechResult: what a screen reader would announce
 *   - focusedElement: DOM info about where focus landed (tag, id, rect)
 *   - focusIndicator: CSS analysis of the visual focus indicator
 *
 * Fixture: dropdown-nav.html
 *   A WAI-ARIA Menubar with 5 top-level items. Tab lands on Home,
 *   ArrowRight moves to Products, Services, About, Contact Us.
 *
 * To reproduce in your own app:
 *   1. Use `cy.a11yPressKey('Tab')` instead of `cy.a11yPress('Tab')` to
 *      get the full A11yState.
 *   2. Assert on `state.speech` for screen reader output.
 *   3. Assert on `state.focusedElement?.tag` / `?.id` for DOM-level checks.
 *   4. Assert on `state.focusIndicator.meetsWCAG_AA` for visual indicator
 *      compliance.
 *   5. Use `cy.a11yState()` to read the current state without pressing
 *      any key.
 */

describe('Unified A11yState', () => {
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
   * Verify that a11yPressKey('Tab') yields the full A11yState with speech
   * output and a structured SpeechResult.
   *
   * Reproducing: state.speech is the same string you'd get from
   * a11yPress('Tab'). state.speechResult adds the raw AXNode for
   * advanced inspection.
   */
  it('a11yPressKey returns A11yState with speech', () => {
    // a11yPressKey dispatches a native CDP key event and yields A11yState
    cy.a11yPressKey('Tab').then((state) => {
      // speech is the string output (e.g., "Home, menu item")
      expect(state).to.exist;
      expect(state.speech).to.contain('Home');
      // speechResult has the structured breakdown: name, role, states, rawNode
      expect(state.speechResult).to.not.be.null;
      expect(state.speechResult?.name).to.exist;
      expect(state.speechResult?.role).to.exist;
    });
  });

  /**
   * Verify that a11yPressKey yields DOM-level info about the focused
   * element: tag name, tabIndex, and bounding rectangle.
   *
   * Reproducing: Use state.focusedElement to assert that focus landed
   * on the correct DOM element — useful when speech alone isn't enough.
   */
  it('a11yPressKey returns focused element info', () => {
    cy.a11yPressKey('Tab').then((state) => {
      // focusedElement gives DOM info from document.activeElement
      expect(state.focusedElement).to.not.be.null;
      expect(state.focusedElement?.tag).to.exist;
      expect(state.focusedElement?.tabIndex).to.be.a('number');
      // rect gives bounding box for layout or visual regression assertions
      expect(state.focusedElement?.rect).to.exist;
    });
  });

  /**
   * Verify that a11yPressKey yields focus indicator analysis for
   * WCAG 2.4.12 AA compliance.
   *
   * Reproducing: Check state.focusIndicator.isVisible to confirm a
   * visual focus indicator exists. Check meetsWCAG_AA for contrast
   * compliance (visible AND contrast >= 3.0).
   */
  it('a11yPressKey returns focus indicator analysis', () => {
    cy.a11yPressKey('Tab').then((state) => {
      expect(state.focusIndicator).to.exist;
      // isVisible: whether any outline or box-shadow focus indicator exists
      expect(state.focusIndicator.isVisible).to.be.a('boolean');
      // meetsWCAG_AA: true if visible AND contrast ratio >= 3.0
      expect(state.focusIndicator.meetsWCAG_AA).to.be.a('boolean');
    });
  });

  /**
   * Verify that a11yState() reads the current state WITHOUT pressing a key.
   *
   * Reproducing: Focus an element via cy.a11yPress() or cy.get().focus(),
   * then call cy.a11yState() to inspect the current state. Useful for
   * checking state after programmatic focus changes or click handlers.
   */
  it('a11yState returns state without key press', () => {
    // Press Tab first to give focus to the first menu item
    cy.a11yPress('Tab');

    // a11yState() reads current state — no additional key press needed
    cy.a11yState().then((state) => {
      expect(state.speech).to.contain('Home');
      expect(state.focusedElement).to.not.be.null;
    });
  });

  /**
   * Verify that sequential a11yPressKey calls update the state as
   * focus moves through the menubar.
   *
   * Reproducing: Each a11yPressKey call yields a fresh A11yState snapshot
   * reflecting the newly focused element. Compare consecutive states to
   * verify focus movement.
   */
  it('sequential a11yPressKey calls update state', () => {
    // First Tab → Home
    cy.a11yPressKey('Tab').then((state1) => {
      expect(state1.speech).to.contain('Home');

      // ArrowRight → Products (different element)
      cy.a11yPressKey('ArrowRight').then((state2) => {
        expect(state2.speech).to.contain('Products');
      });
    });
  });
});
