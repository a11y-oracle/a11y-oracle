That is an excellent strategic pivot. As a QA professional who has wrestled with brittle tests, I completely agree. Tying automation to the exact, proprietary phrasing of NVDA, JAWS, or VoiceOver is a trap. Those screen readers frequently change their verbosity rules with minor OS updates, which would cause your test suite to fail randomly.

Standardizing on a "Logical W3C Baseline"—where the output is simply guaranteed to be accurate, acceptable, and contextually sound—is the most sustainable path.

Furthermore, introducing an **Nx workspace** is the perfect architectural decision. Since this tool will eventually consist of a core engine, multiple framework wrappers (Cypress, Playwright), and a testing sandbox, an Nx monorepo will keep your dependency graph clean and your builds incredibly fast.

Here is the revised Technical Requirements Document.

---

# Technical Requirements Document: A11y-Oracle (v2.0)

## 1. Executive Summary

**A11y-Oracle** is a Node.js-based, open-source testing utility designed to intercept the browser's Accessibility Tree (AXTree) via the Chrome DevTools Protocol (CDP). Instead of attempting to perfectly mimic proprietary OS-level screen readers, A11y-Oracle generates a "Standardized Speech Output" based strictly on W3C specifications. Hosted within an Nx monorepo, it provides seamless integrations for both Playwright and Cypress, allowing developers to assert that their UI communicates the correct Name, Role, and Value to assistive technologies.

## 2. Repository Architecture (Nx Workspace)

To manage the complexity of cross-framework support, the project will be structured as an Nx workspace. This allows us to share the core logic while building distinct npm packages for end-users.

### Workspace Structure:

* **`libs/core-engine`**: The source of truth. Contains the CDP connection logic, AXTree parsing, and the W3C ACDC (Accessible Name and Description Computation) algorithm.
* **`libs/playwright-plugin`**: A Playwright fixture wrapper that consumes `core-engine`.
* **`libs/cypress-plugin`**: Custom Cypress commands and the Node event listeners required to route CDP data through Cypress's backend.
* **`apps/sandbox`**: A simple local web app containing our "Ground Truth Dataset" (HTML files of navigation menus, modals, etc.) used for local testing.
* **`apps/e2e-tests`**: Playwright/Cypress suites that run against the `sandbox` to verify the plugins work as expected.

## 3. The Standardized Speech Engine

Because we are abandoning the goal of perfectly matching NVDA or VoiceOver, our engine must follow a strict, predictable syntax that developers can easily write assertions against.

### The Output Syntax Standard

Every focused element will generate a string in this exact format:
`[Computed Name], [Role], [State/Properties]`

**Examples:**

* `<button aria-expanded="false">Products</button>` → `"Products, button, collapsed"`
* `<nav aria-label="Main">...</nav>` → `"Main, navigation landmark"`
* `<a href="/home">Home</a>` → `"Home, link"`

### The Computation Rules (W3C ACDC)

The `core-engine` will recursively evaluate nodes based on the W3C algorithm:

1. **`aria-labelledby`**: Follow ID references.
2. **`aria-label`**: Use direct string values.
3. **Native Attributes**: Evaluate `<img alt="...">` or `<input aria-placeholder="...">`.
4. **Text Content**: Traverse child text nodes.
5. **Role & State Mapping**: Translate `aria-expanded="false"` to the word `"collapsed"` and map implicit HTML tags (like `<button>`) to their explicit ARIA roles.

## 4. Framework Integration Strategy

### Playwright (`libs/playwright-plugin`)

Playwright's native CDP support makes it the most robust target.

* **Mechanism:** Leverage `page.context().newCDPSession(page)`.
* **API Design:** Provide a custom fixture or a class instance.
```javascript
await a11y.press('Tab');
expect(await a11y.getSpeech()).toBe('Contact Us, link');

```



### Cypress (`libs/cypress-plugin`)

Cypress requires passing messages between the browser context and the Node backend.

* **Mechanism:** Use `Cypress.automation('remote:debugger:protocol', ...)` to fetch the AXTree.
* **API Design:** Provide custom commands that yield the standardized string.
```javascript
cy.realPress('Tab');
cy.getA11ySpeech().should('eq', 'Contact Us, link');

```



## 5. Monetization & Commercial Strategy (A11y-Oracle Pro)

By keeping the core engine standard and predictable, the open-source version remains highly valuable for CI/CD pipelines. The commercial layer can focus on workflow and reporting enhancements:

* **The "Audio Audit" Dashboard:** A SaaS dashboard that consumes the test logs and generates an interactive, playable timeline of the test run, highlighting where focus went and what was "spoken."
* **Visual Focus Regression:** Automated screenshot diffing specifically targeting the `:focus-visible` state to ensure WCAG 2.2 AA Focus Appearance compliance.
* **Enterprise Support & SLA:** Assisting large teams with custom integrations for complex Shadow DOM or iframe-heavy applications.

## 6. Phased Implementation Plan

* **Phase 1: Scaffolding (Week 1)**
* Initialize the Nx workspace.
* Create the `sandbox` app with a standard WCAG-compliant dropdown navigation menu.


* **Phase 2: Core Engine & CDP (Weeks 2-4)**
* Develop `libs/core-engine` to successfully connect to a raw CDP session.
* Implement the W3C ACDC parser for basic elements (buttons, links, inputs).


* **Phase 3: Playwright Plugin (Weeks 5-6)**
* Build `libs/playwright-plugin`.
* Write E2E tests in the Nx workspace proving the plugin accurately reads the `sandbox` navigation menu.


* **Phase 4: Cypress Plugin (Weeks 7-8)**
* Build `libs/cypress-plugin` using Cypress task/automation workarounds.
* Ensure feature parity with the Playwright plugin.



---

By dropping the requirement to chase OS-specific screen reader quirks, you have massively reduced the maintenance burden of this project. It is now a highly realistic, solvable engineering problem.

Would you like me to provide the exact terminal commands to scaffold this specific Nx workspace structure, including the React sandbox and Playwright/Cypress applications, so you can initialize the repo today?