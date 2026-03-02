# A11y-Oracle

A Node.js testing utility that intercepts the browser's Accessibility Tree via the Chrome DevTools Protocol (CDP) and generates standardized speech output. Assert that your UI communicates the correct Name, Role, and State to assistive technologies.

## Why A11y-Oracle?

Screen readers like NVDA, JAWS, and VoiceOver each have proprietary verbosity rules that change between OS updates. Tying test assertions to their exact phrasing produces brittle test suites.

A11y-Oracle takes a different approach: it reads the browser's own accessibility tree (the same data assistive technologies consume) and produces a **standardized speech string** based on W3C specifications. The output format is predictable and stable:

```
[Computed Name], [Role], [State/Properties]
```

**Examples:**

| HTML | Speech Output |
|------|--------------|
| `<button aria-expanded="false">Products</button>` | `Products, button, collapsed` |
| `<nav aria-label="Main">...</nav>` | `Main, navigation landmark` |
| `<a href="/home">Home</a>` | `Home, link` |
| `<input type="checkbox" checked aria-label="Agree">` | `Agree, checkbox, checked` |

## Architecture

A11y-Oracle is structured as an Nx monorepo with three publishable packages:

```
a11y-oracle/
  libs/
    core-engine/          @a11y-oracle/core-engine
    playwright-plugin/    @a11y-oracle/playwright-plugin
    cypress-plugin/       @a11y-oracle/cypress-plugin
  apps/
    sandbox/              WCAG-compliant test fixtures (HTML)
    e2e-tests/            Playwright E2E tests
    cypress-e2e/          Cypress E2E tests
```

- **`@a11y-oracle/core-engine`** is the framework-agnostic speech engine. It depends only on a `CDPSessionLike` interface, not on any test framework.
- **`@a11y-oracle/playwright-plugin`** wraps the core engine with Playwright-specific lifecycle management and provides a test fixture.
- **`@a11y-oracle/cypress-plugin`** wraps the core engine with Cypress custom commands, handling Cypress's iframe architecture transparently.

## Quick Start

### With Playwright

```bash
npm install @a11y-oracle/playwright-plugin
```

```typescript
import { test, expect } from '@a11y-oracle/playwright-plugin';

test('dropdown menu keyboard navigation', async ({ page, a11y }) => {
  await page.goto('/dropdown-nav.html');

  // Tab to the first menu item
  const speech = await a11y.press('Tab');
  expect(speech).toContain('Home');
  expect(speech).toContain('menu item');

  // Arrow right to a button with submenu
  const products = await a11y.press('ArrowRight');
  expect(products).toBe('Products, menu item, collapsed');

  // Open the submenu
  const clothing = await a11y.press('Enter');
  expect(clothing).toContain('Clothing');

  // Verify landmarks exist in the page
  const tree = await a11y.getFullTreeSpeech();
  const nav = tree.find(r => r.speech.includes('navigation landmark'));
  expect(nav).toBeDefined();
});
```

### With Cypress

```bash
npm install @a11y-oracle/cypress-plugin
```

**cypress/support/e2e.ts:**

```typescript
import '@a11y-oracle/cypress-plugin';
```

**cypress/e2e/dropdown.cy.ts:**

```typescript
describe('Dropdown Navigation', () => {
  beforeEach(() => {
    cy.visit('/dropdown-nav.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('Tab announces first menu item', () => {
    cy.a11yPress('Tab').should('contain', 'Home');
  });

  it('Enter opens submenu', () => {
    cy.a11yPress('Tab');
    cy.a11yPress('ArrowRight');
    cy.a11yPress('Enter').should('contain', 'Clothing');
  });
});
```

## Speech Output Format

Every element produces a string following this pattern:

```
[Computed Name], [Role], [State/Properties]
```

Parts are omitted when empty. Multiple states are comma-separated in a fixed order.

### Roles

The engine maps 50+ CDP role values to speech strings. Common mappings:

| CDP Role | Speech | Category |
|----------|--------|----------|
| `button` | `button` | Interactive |
| `link` | `link` | Interactive |
| `checkbox` | `checkbox` | Interactive |
| `radio` | `radio button` | Interactive |
| `textbox` | `edit text` | Interactive |
| `combobox` | `combo box` | Interactive |
| `menuitem` | `menu item` | Interactive |
| `tab` | `tab` | Interactive |
| `navigation` | `navigation landmark` | Landmark |
| `main` | `main landmark` | Landmark |
| `banner` | `banner landmark` | Landmark |
| `heading` | `heading` | Structure |
| `list` | `list` | Structure |
| `table` | `table` | Structure |
| `dialog` | `dialog` | Structure |
| `generic` | *(silent)* | Silent |
| `presentation` | *(silent)* | Silent |

Landmark roles automatically append "landmark" (configurable via `includeLandmarks` option). Unknown roles pass through as-is for forward compatibility.

### States

Boolean ARIA properties are mapped to spoken strings:

| ARIA Property | `true` | `false` |
|--------------|--------|---------|
| `aria-expanded` | `expanded` | `collapsed` |
| `aria-checked` | `checked` | `not checked` |
| `aria-selected` | `selected` | *(silent)* |
| `aria-pressed` | `pressed` | `not pressed` |
| `aria-disabled` | `dimmed` | *(silent)* |
| `aria-required` | `required` | *(silent)* |
| `aria-invalid` | `invalid` | *(silent)* |
| `aria-readonly` | `read only` | *(silent)* |

Heading levels are announced as `level N` (e.g., `Intro, heading, level 2`).

## Requirements

- **Chromium-based browser** (Chrome, Edge, Electron). CDP is not available for Firefox or WebKit.
- **Node.js** >= 18
- **Playwright** >= 1.40 (for the Playwright plugin)
- **Cypress** >= 12 (for the Cypress plugin)

## Development

This is an Nx monorepo. Common tasks:

```bash
# Build all libraries
npx nx run-many --targets=build

# Run core engine unit tests (117 tests)
npx nx test core-engine

# Run Playwright E2E tests (9 tests)
npx nx e2e e2e-tests

# Run Cypress E2E tests (9 tests)
npx nx e2e cypress-e2e

# Visualize project dependency graph
npx nx graph
```

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@a11y-oracle/core-engine`](libs/core-engine) | Framework-agnostic speech engine | [README](libs/core-engine/README.md) |
| [`@a11y-oracle/playwright-plugin`](libs/playwright-plugin) | Playwright test fixture and wrapper | [README](libs/playwright-plugin/README.md) |
| [`@a11y-oracle/cypress-plugin`](libs/cypress-plugin) | Cypress custom commands | [README](libs/cypress-plugin/README.md) |

## How It Works

1. **CDP Connection** -- The plugin establishes a Chrome DevTools Protocol session with the browser.
2. **Accessibility Tree Fetch** -- `Accessibility.getFullAXTree()` returns a flat array of AXNodes. Chrome has already computed accessible names per the W3C AccName spec.
3. **Focus Detection** -- The engine finds the node with `focused: true`. When multiple nodes report focus (e.g., both `RootWebArea` and a `menuitem`), the deepest (most specific) node is selected.
4. **Speech Computation** -- The node's role is mapped via `ROLE_TO_SPEECH`, boolean properties are mapped via `STATE_MAPPINGS`, and the parts are joined into the final speech string.

## License

MIT
