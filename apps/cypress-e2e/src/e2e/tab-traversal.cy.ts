/**
 * E2E tests for tab order traversal and keyboard trap detection via Cypress.
 *
 * Uses the keyboard-trap.html sandbox fixture to verify tab order
 * extraction and WCAG 2.1.2 keyboard trap detection.
 */

describe('Tab Order Traversal', () => {
  beforeEach(() => {
    cy.visit('/keyboard-trap.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('a11yTraverseTabOrder returns all tabbable elements', () => {
    cy.a11yTraverseTabOrder().then((report) => {
      expect(report.totalCount).to.be.greaterThan(0);
      expect(report.entries).to.have.length(report.totalCount);

      // Should include buttons and inputs
      const tags = report.entries.map((e) => e.tag);
      expect(tags).to.include('BUTTON');
      expect(tags).to.include('INPUT');
    });
  });

  it('tab order entries have expected properties', () => {
    cy.a11yTraverseTabOrder().then((report) => {
      const first = report.entries[0];

      expect(first.index).to.equal(0);
      expect(first.tag).to.exist;
      expect(first.tabIndex).to.be.a('number');
      expect(first.rect).to.exist;
      expect(first.rect.x).to.be.a('number');
      expect(first.rect.width).to.be.a('number');
    });
  });

  it('detects keyboard trap in bad container', () => {
    // Focus the first button inside the trap
    cy.get('#trap-btn-1').focus();
    cy.wait(50);

    cy.a11yTraverseSubTree('#bad-trap', 10).then((result) => {
      expect(result.isTrapped).to.be.true;
      expect(result.tabCount).to.equal(10);
      expect(result.visitedElements).to.have.length.greaterThan(0);
      expect(result.escapeElement).to.be.null;
    });
  });

  it('detects escape from good container', () => {
    // Focus the first input in the good form
    cy.get('#name-input').focus();
    cy.wait(50);

    cy.a11yTraverseSubTree('#good-form', 10).then((result) => {
      expect(result.isTrapped).to.be.false;
      expect(result.escapeElement).to.not.be.null;
      expect(result.visitedElements).to.have.length.greaterThan(0);
    });
  });
});
