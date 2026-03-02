This is a brilliant architectural progression. As a Senior QA Engineer, I can tell you that testing screen reader output without testing keyboard flow is like checking if a car's radio works without checking if the steering wheel turns. Screen reader users _are_ keyboard users. Unifying these two pillars into a single API creates the ultimate accessibility testing suite.

Since we already established the Chrome DevTools Protocol (CDP) connection for the Accessibility Tree in Phase 1, we can leverage that exact same CDP connection to dispatch **100% native, OS-level keystrokes** and intercept focus styling.

Here is the Phase 2 Technical Requirements Document to expand the Nx workspace into a comprehensive A11y Automation suite.

---

# Technical Requirements Document: A11y-Oracle (Phase 2 - Keyboard & Focus Dynamics)

## 1. Executive Summary

Phase 2 of the **A11y-Oracle** project expands the core engine to fully automate and assert WCAG 2.1 and 2.2 AA keyboard compliance. By leveraging the existing CDP bridge, the tool will dispatch native hardware-level keystrokes (bypassing framework-specific quirks in Cypress or Playwright) and track focus movement, focus traps, and visual focus indicators. This unifies "What it says" (Phase 1) with "How it moves" (Phase 2) into a single, seamless Developer Experience (DX).

## 2. Expanded Architecture (Nx Workspace Additions)

We will introduce two new core libraries to the Nx workspace to handle the complex physics of keyboard navigation.

### New Workspace Libraries:

- **`libs/keyboard-engine`**: A wrapper around CDP's `Input.dispatchKeyEvent`. This guarantees that when the test says "Tab", the browser fires the exact same system events as a user physically pressing the Tab key, avoiding the synthetic event pitfalls of standard JavaScript `.dispatchEvent()`.
- **`libs/focus-analyzer`**: A DOM-monitoring utility that tracks `document.activeElement`, calculates the expected logical tab order versus the actual tab order, and inspects computed CSS properties for focus visibility.

## 3. Core Capabilities & Technical Implementations

### A. The "Tab & Track" Engine (WCAG 2.1.1 & 2.4.3)

Instead of forcing developers to write a test for every single keystroke, the engine will feature an "Auto-Traversal" mode.

- **Mechanism:** The engine extracts all interactable elements from the DOM (buttons, links, inputs, `tabindex="0"`). It then repeatedly dispatches the `Tab` key via CDP.
- **Validation:** It compares the _DOM order_ to the _Visual/Actual order_. If focus drops, skips, or gets stuck (a Keyboard Trap, WCAG 2.1.2), the test throws a descriptive error.

### B. Intelligent Roving Tabindex (Arrow Keys)

Complex widgets (like your main navigation dropdowns, tabs, or comboboxes) require arrow-key navigation, not just the Tab key.

- **Mechanism:** The API will expose `a11y.press('ArrowDown')` and immediately capture both the DOM focus shift and the subsequent AXTree speech output.

### C. Visual Focus Appearance (WCAG 2.2 SC 2.4.12)

This is the hardest manual test to automate, but CDP makes it possible. WCAG 2.2 requires the focus indicator to have a 3:1 contrast ratio against the background and be of a sufficient pixel size.

- **Mechanism:** When an element receives focus, `libs/focus-analyzer` queries the element's computed styles (`outline`, `box-shadow`, `border`, `background-color`). It calculates the contrast difference between the `:focus` state and the default state.

## 4. API Design & Developer Experience (DX)

The true power of Phase 2 is combining the assertions. Developers can assert the action, the visual state, and the auditory state in one fluid motion.

### Playwright Integration Example

```javascript
// libs/playwright-plugin usage
test('Main Navigation keyboard flow and speech', async ({ a11y }) => {
  await a11y.goto('/');

  // Action: Press Tab
  const state = await a11y.press('Tab');

  // Assert Keyboard (Phase 2)
  expect(state.focusedElement).toHaveId('nav-trigger-products');
  expect(state.focusIndicator.contrastRatio).toBeGreaterThan(3.0); // WCAG 2.2 AA

  // Assert Speech (Phase 1)
  expect(state.speechOutput).toBe('Products, menu button, collapsed');

  // Action: Open Menu
  await a11y.press('Enter');

  // Assert Focus Trap Prevention (Phase 2)
  // Ensure we can tab entirely through the submenu and exit naturally
  const traversalResult = await a11y.traverseSubTree(
    '#nav-trigger-products-menu'
  );
  expect(traversalResult.isTrapped).toBe(false);
});
```

### Cypress Integration Example

```javascript
// libs/cypress-plugin usage
it('Verifies dropdown navigation with arrow keys', () => {
  cy.get('#nav-trigger-products').focus();

  // Custom Command utilizing CDP for native key events
  cy.a11yPress('ArrowDown');

  // Chained assertions covering both Keyboard and Screen Reader standards
  cy.a11yState().should((state) => {
    expect(state.focusedElement.text).to.eq('Laptops');
    expect(state.speechOutput).to.eq('Laptops, link');
    expect(state.focusIndicator.isVisible).to.be.true;
  });
});
```

## 5. Monetization Strategy (A11y-Oracle Pro - Phase 2 Additions)

While basic tab tracking and key dispatching belong in the Open Source community edition, Phase 2 unlocks massive potential for enterprise features:

- **Automated Tab-Order Topography Maps:** The SaaS dashboard visually maps a screenshot of the page and draws the literal "Tab Path" with numbered nodes. If the tab order visually jumps from the top right to the bottom left and back, it is flagged as a Cognitive Failure (WCAG 2.4.3).
- **AI-Powered Focus Ring Diffing:** Some teams use complex `transform` or SVG animations for focus states that CSS analysis can't catch. The Pro version can capture pre/post focus screenshots and use an optimized vision model to mathematically verify the 3:1 contrast boundary required by WCAG 2.2.
- **Focus Trap Heatmaps:** Highlighting areas of complex web apps (like modals within modals) where focus gets orphaned.

## 6. Implementation Milestones

- **Step 1: The Native Key Dispatcher:** Map standard keyboard events (`Tab`, `Shift+Tab`, `Enter`, `Space`, Arrows) to the CDP `Input.dispatchKeyEvent` command in `core-engine`.
- **Step 2: Focus Node Synchronization:** Ensure that when a CDP keystroke occurs, the engine simultaneously captures `document.activeElement` and its corresponding AXTree node.
- **Step 3: The Focus Analyzer Prototype:** Write the CSS extraction logic to read `outline-color` and `box-shadow`, calculating luminosity against the parent background.
- **Step 4: Unified API Wrapping:** Update the Playwright and Cypress plugins to return the unified `state` object containing both keyboard and speech data.

---

This completes the blueprint. By combining Phase 1 and Phase 2, you are no longer just building a testing tool; you are building an automated replica of a user with disabilities interacting with the DOM.

Would you like me to map out the specific **Data Schema** for the `state` object (the JSON payload that gets returned every time `a11y.press()` is called) so your team knows exactly what data points they will be writing assertions against?
