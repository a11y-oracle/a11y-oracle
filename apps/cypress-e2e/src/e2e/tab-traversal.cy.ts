/**
 * E2E tests for tab order traversal and keyboard trap detection via Cypress.
 *
 * These tests verify two key WCAG requirements:
 *   - Tab order: all interactive elements are reachable via Tab in a
 *     logical order (WCAG 2.4.3 Focus Order)
 *   - Keyboard traps: focus must not get stuck in any container
 *     (WCAG 2.1.2 No Keyboard Trap)
 *
 * Fixture: keyboard-trap.html
 *   Contains two containers:
 *     #bad-trap  — A keyboard trap: JavaScript intercepts Tab and cycles
 *                  focus between 3 buttons, never allowing escape.
 *     #good-form — A normal form with 2 inputs: Tab exits naturally
 *                  to the "Outside Button" below.
 *
 * To reproduce in your own app:
 *   1. Use `cy.a11yTraverseTabOrder()` to extract all tabbable elements
 *      and verify count/order.
 *   2. Use `cy.a11yTraverseSubTree('#container', maxTabs)` to check if
 *      focus can escape a specific container.
 *   3. Assert `result.isTrapped === false` for all containers that
 *      should allow Tab escape.
 */

describe('Tab Order Traversal', () => {
  beforeEach(() => {
    cy.visit('/keyboard-trap.html');
    // Initialize A11y-Oracle — must be called AFTER cy.visit()
    cy.initA11yOracle();
  });

  afterEach(() => {
    // Always dispose to release CDP resources
    cy.disposeA11yOracle();
  });

  /**
   * Verify that a11yTraverseTabOrder() returns all tabbable elements
   * on the page — useful for auditing focus order and finding missing
   * or unexpected tabbable elements.
   *
   * Reproducing: Call cy.a11yTraverseTabOrder() on any page. It queries
   * the DOM for all focusable elements, filters out hidden/disabled ones,
   * and returns them sorted by tabIndex.
   */
  it('a11yTraverseTabOrder returns all tabbable elements', () => {
    cy.a11yTraverseTabOrder().then((report) => {
      // Verify we found tabbable elements and the count matches
      expect(report.totalCount).to.be.greaterThan(0);
      expect(report.entries).to.have.length(report.totalCount);

      // The page has buttons (in trap + outside) and inputs (in form)
      const tags = report.entries.map((e) => e.tag);
      expect(tags).to.include('BUTTON');
      expect(tags).to.include('INPUT');
    });
  });

  /**
   * Verify that each tab order entry has all expected properties:
   * index, tag, tabIndex, and bounding rect.
   *
   * Reproducing: Use these properties to build a visual tab order
   * overlay or assert specific elements appear at expected positions.
   */
  it('tab order entries have expected properties', () => {
    cy.a11yTraverseTabOrder().then((report) => {
      const first = report.entries[0];

      // Each entry includes position, element info, and bounding rect
      expect(first.index).to.equal(0);
      expect(first.tag).to.exist;
      expect(first.tabIndex).to.be.a('number');
      expect(first.rect).to.exist;
      expect(first.rect.x).to.be.a('number');
      expect(first.rect.width).to.be.a('number');
    });
  });

  /**
   * Verify that a keyboard trap is correctly detected: the #bad-trap
   * container intercepts Tab and cycles focus between its 3 buttons,
   * never allowing escape.
   *
   * Reproducing: Call cy.a11yTraverseSubTree('#container', maxTabs)
   * where maxTabs is the max Tab presses before declaring a trap.
   * If `result.isTrapped === true`, focus never escaped — this is a
   * WCAG 2.1.2 failure.
   */
  it('detects keyboard trap in bad container', () => {
    // Focus the first button inside the trap container
    cy.get('#trap-btn-1').focus();
    cy.wait(50);

    // a11yTraverseSubTree presses Tab up to 10 times, checking if
    // focus escapes the #bad-trap container after each press
    cy.a11yTraverseSubTree('#bad-trap', 10).then((result) => {
      // Focus never escaped — this IS a keyboard trap (WCAG 2.1.2 failure)
      expect(result.isTrapped).to.be.true;
      // All 10 Tab presses exhausted without escaping
      expect(result.tabCount).to.equal(10);
      // Focus visited elements inside the trap
      expect(result.visitedElements).to.have.length.greaterThan(0);
      // No escape element (focus never left the container)
      expect(result.escapeElement).to.be.null;
    });
  });

  /**
   * Verify that a well-behaved container allows focus to escape:
   * the #good-form has 2 inputs, and Tab exits naturally to the
   * "Outside Button" below.
   *
   * Reproducing: For containers that SHOULD allow escape (forms, cards,
   * etc.), assert `result.isTrapped === false` and inspect
   * `result.escapeElement` to see where focus went.
   */
  it('detects escape from good container', () => {
    // Focus the first input in the form
    cy.get('#name-input').focus();
    cy.wait(50);

    // a11yTraverseSubTree checks if focus can escape #good-form
    cy.a11yTraverseSubTree('#good-form', 10).then((result) => {
      // Focus DID escape — this is NOT a keyboard trap (WCAG 2.1.2 pass)
      expect(result.isTrapped).to.be.false;
      // escapeElement tells you which element received focus after escaping
      expect(result.escapeElement).to.not.be.null;
      // Some elements inside the form were visited before escaping
      expect(result.visitedElements).to.have.length.greaterThan(0);
    });
  });
});
