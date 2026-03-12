# A11y-Oracle

A Node.js testing utility that intercepts the browser's Accessibility Tree via the Chrome DevTools Protocol (CDP) and generates standardized speech output, keyboard navigation analysis, and focus indicator validation. Assert that your UI communicates the correct Name, Role, and State to assistive technologies — and that it's fully keyboard accessible.

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

Beyond speech, A11y-Oracle also provides **unified accessibility state** that combines speech output with keyboard navigation data and visual focus indicator analysis — letting you verify WCAG keyboard accessibility requirements in a single assertion.

## Architecture

A11y-Oracle is structured as an Nx monorepo with nine publishable packages:

```
a11y-oracle/
  libs/
    core-engine/          @a11y-oracle/core-engine
    keyboard-engine/      @a11y-oracle/keyboard-engine
    focus-analyzer/       @a11y-oracle/focus-analyzer
    visual-engine/        @a11y-oracle/visual-engine
    axe-bridge/           @a11y-oracle/axe-bridge
    cdp-types/            @a11y-oracle/cdp-types
    audit-formatter/      @a11y-oracle/audit-formatter
    playwright-plugin/    @a11y-oracle/playwright-plugin
    cypress-plugin/       @a11y-oracle/cypress-plugin
  apps/
    sandbox/              WCAG-compliant test fixtures (HTML)
    e2e-tests/            Playwright E2E tests
    cypress-e2e/          Cypress E2E tests
```

### Dependency Graph

```
cdp-types              (standalone — CDPSessionLike interface)
keyboard-engine   ──→  cdp-types
focus-analyzer    ──→  keyboard-engine
core-engine       ──→  keyboard-engine + focus-analyzer
visual-engine     ──→  focus-analyzer + cdp-types
axe-bridge        ──→  visual-engine + focus-analyzer + keyboard-engine + cdp-types
audit-formatter   ──→  core-engine + focus-analyzer (types only)
playwright-plugin ──→  core-engine
cypress-plugin    ──→  core-engine + keyboard-engine + audit-formatter
```

- **`@a11y-oracle/cdp-types`** — Shared `CDPSessionLike` interface for framework-agnostic CDP access (Playwright, Puppeteer, Cypress).
- **`@a11y-oracle/core-engine`** — Framework-agnostic speech engine and unified `A11yOrchestrator`. Depends only on a `CDPSessionLike` interface.
- **`@a11y-oracle/keyboard-engine`** — Native CDP keyboard dispatch with modifier key support and focused element introspection.
- **`@a11y-oracle/focus-analyzer`** — Focus indicator CSS analysis (WCAG 2.4.12), tab order extraction, and keyboard trap detection (WCAG 2.1.2).
- **`@a11y-oracle/visual-engine`** — Visual pixel analysis engine for color contrast resolution: CSS halo heuristic detection, CDP screenshot capture, and pixel-level luminance analysis.
- **`@a11y-oracle/axe-bridge`** — Axe-core result post-processor that resolves 10 "incomplete" rules using visual analysis, keyboard interaction, and CDP inspection.
- **`@a11y-oracle/audit-formatter`** — Converts findings to axe-core-compatible `OracleIssue` objects with WCAG rule metadata. Pure functions, no CDP dependency.
- **`@a11y-oracle/playwright-plugin`** — Playwright test fixture wrapping the core engine.
- **`@a11y-oracle/cypress-plugin`** — Cypress custom commands with iframe-aware CDP routing and issue reporting.

## Quick Start

### With Playwright

```bash
npm install @a11y-oracle/playwright-plugin
```

#### Speech Assertions

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
});
```

#### Unified State (Speech + Focus + Indicator)

```typescript
import { test, expect } from '@a11y-oracle/playwright-plugin';

test('Tab produces unified accessibility state', async ({ page, a11y }) => {
  await page.goto('/my-page.html');

  const state = await a11y.pressKey('Tab');

  // Speech
  expect(state.speech).toContain('Submit');

  // Focused element info
  expect(state.focusedElement?.tag).toBe('BUTTON');
  expect(state.focusedElement?.id).toBe('submit-btn');

  // Focus indicator meets WCAG 2.4.12 AA
  expect(state.focusIndicator.isVisible).toBe(true);
  expect(state.focusIndicator.meetsWCAG_AA).toBe(true);
});
```

#### Keyboard Trap Detection

```typescript
test('modal does not trap focus', async ({ page, a11y }) => {
  await page.goto('/modal-dialog.html');

  const result = await a11y.traverseSubTree('#modal-container', 20);
  expect(result.isTrapped).toBe(false);
});
```

### With Cypress

> **⚠️ Playwright is recommended over Cypress.** The Cypress plugin is functional but has known stability issues with long test suites due to how Cypress manages CDP sessions through its iframe architecture. Repeated `initA11yOracle()`/`disposeA11yOracle()` cycles accumulate browser resources (isolated execution worlds) that Chrome does not fully release, which can cause hangs or memory pressure after many tests. A mitigation was added in v1.3.1 ([#14](https://github.com/a11y-oracle/a11y-oracle/issues/14)), but the underlying architectural constraints remain. For the most reliable experience, use the [Playwright plugin](libs/playwright-plugin/README.md).

```bash
npm install @a11y-oracle/cypress-plugin
```

**cypress/support/e2e.ts:**

```typescript
import '@a11y-oracle/cypress-plugin';
```

#### Speech Assertions

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

#### Unified State (Speech + Focus + Indicator)

```typescript
it('Tab returns unified accessibility state', () => {
  cy.a11yPressKey('Tab').then((state) => {
    expect(state.speech).to.contain('Submit');
    expect(state.focusedElement?.tag).to.equal('BUTTON');
    expect(state.focusIndicator.meetsWCAG_AA).to.be.true;
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

## Unified A11yState

The `pressKey()` method (available on both Playwright and Cypress) returns a single `A11yState` snapshot combining three dimensions:

| Field | Type | Description |
|-------|------|-------------|
| `speech` | `string` | Speech output (e.g. `"Products, button, collapsed"`) |
| `speechResult` | `SpeechResult \| null` | Full speech result with raw AXNode data |
| `focusedElement` | `A11yFocusedElement \| null` | DOM info: tag, id, role, text, rect |
| `focusIndicator` | `A11yFocusIndicator` | CSS analysis: isVisible, contrastRatio, meetsWCAG_AA |

The `focusIndicator` field checks WCAG 2.4.12 AA compliance:
- **`isVisible`** — Whether a visual focus indicator (outline or box-shadow) exists
- **`contrastRatio`** — Contrast ratio of the indicator against the background (`null` if unparseable)
- **`meetsWCAG_AA`** — `true` if visible and contrast ratio >= 3.0

## Requirements

- **Chromium-based browser** (Chrome, Edge, Electron). CDP is not available for Firefox or WebKit.
- **Node.js** >= 18
- **Playwright** >= 1.40 (for the Playwright plugin)
- **Cypress** >= 12 (for the Cypress plugin)

## Development

This is an Nx monorepo. Common tasks:

```bash
# Build all libraries
npm exec nx run-many -- --targets=build

# Run all unit tests (447 tests across 6 packages)
npm exec nx run-many -- --targets=test

# Run core engine unit tests (129 tests)
npm exec nx test core-engine

# Run keyboard engine unit tests (17 tests)
npm exec nx test keyboard-engine

# Run focus analyzer unit tests (59 tests)
npm exec nx test focus-analyzer

# Run visual engine unit tests (56 tests)
npm exec nx test visual-engine

# Run audit formatter unit tests (115 tests)
npm exec nx test audit-formatter

# Run axe-bridge unit tests (71 tests)
npm exec nx test axe-bridge

# Run Playwright E2E tests (53 tests)
npm exec nx e2e e2e-tests

# Run Cypress E2E tests (51 tests)
npm exec nx e2e cypress-e2e

# Visualize project dependency graph
npm exec nx graph
```

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@a11y-oracle/cdp-types`](libs/cdp-types) | Shared `CDPSessionLike` interface for framework-agnostic CDP access | — |
| [`@a11y-oracle/core-engine`](libs/core-engine) | Framework-agnostic speech engine and unified orchestrator | [README](libs/core-engine/README.md) |
| [`@a11y-oracle/keyboard-engine`](libs/keyboard-engine) | CDP keyboard dispatch with modifier support | [README](libs/keyboard-engine/README.md) |
| [`@a11y-oracle/focus-analyzer`](libs/focus-analyzer) | Focus indicator analysis and keyboard trap detection | [README](libs/focus-analyzer/README.md) |
| [`@a11y-oracle/visual-engine`](libs/visual-engine) | Visual pixel analysis for color contrast resolution | [README](libs/visual-engine/README.md) |
| [`@a11y-oracle/axe-bridge`](libs/axe-bridge) | Axe-core incomplete rule resolver (10 rules) | [README](libs/axe-bridge/README.md) |
| [`@a11y-oracle/audit-formatter`](libs/audit-formatter) | Axe-compatible issue formatting and WCAG audit rules | [README](libs/audit-formatter/README.md) |
| [`@a11y-oracle/playwright-plugin`](libs/playwright-plugin) | Playwright test fixture and wrapper | [README](libs/playwright-plugin/README.md) |
| [`@a11y-oracle/cypress-plugin`](libs/cypress-plugin) | Cypress custom commands | [README](libs/cypress-plugin/README.md) |

## How It Works

### Speech Output

1. **CDP Connection** — The plugin establishes a Chrome DevTools Protocol session with the browser.
2. **Accessibility Tree Fetch** — `Accessibility.getFullAXTree()` returns a flat array of AXNodes. Chrome has already computed accessible names per the W3C AccName spec.
3. **Focus Detection** — The engine finds the node with `focused: true`. When multiple nodes report focus (e.g., both `RootWebArea` and a `menuitem`), the deepest (most specific) node is selected.
4. **Speech Computation** — The node's role is mapped via `ROLE_TO_SPEECH`, boolean properties are mapped via `STATE_MAPPINGS`, and the parts are joined into the final speech string.

### Keyboard & Focus (Unified State)

1. **Key Dispatch** — `Input.dispatchKeyEvent` sends native hardware-level keystrokes (keyDown + keyUp) through CDP, bypassing synthetic JavaScript events.
2. **Focus Settle** — A configurable delay (default 50ms) allows CSS transitions and focus events to complete.
3. **Parallel Collection** — The orchestrator collects speech, focused element info, and focus indicator data in parallel via `Promise.all`.
4. **Focus Indicator Analysis** — `Runtime.evaluate` extracts computed CSS properties (`outline`, `box-shadow`, `background-color`), parses colors, and calculates the WCAG contrast ratio.
5. **Keyboard Trap Detection** — The analyzer focuses the first element in a container, then presses Tab repeatedly. If focus never escapes, it's a WCAG 2.1.2 failure.

## Documentation

- **[Remediation Guide](docs/REMEDIATION.md)** — Detailed guidance for each Oracle rule: what causes failures and how to fix them.

## License

MIT
