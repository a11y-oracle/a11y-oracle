# @a11y-oracle/cypress-plugin

Cypress integration for A11y-Oracle. Provides custom commands that read the browser's Accessibility Tree via Chrome DevTools Protocol, dispatch native keyboard events, and analyze visual focus indicators.

```typescript
describe('Navigation', () => {
  beforeEach(() => {
    cy.visit('/dropdown-nav.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('Tab to button announces name and role', () => {
    cy.a11yPress('Tab')
      .should('contain', 'Home')
      .and('contain', 'menu item');
  });
});
```

## Installation

```bash
npm install -D @a11y-oracle/cypress-plugin @a11y-oracle/core-engine cypress
```

> **Chrome/Chromium only.** The plugin uses CDP, which is only available in Chrome-family browsers.

> **⚠️ Stability Notice — Playwright recommended.** The Cypress plugin is functional but has known stability constraints with large test suites. We recommend using [`@a11y-oracle/playwright-plugin`](../playwright-plugin/README.md) for the most reliable experience. See [Known Limitations](#known-limitations) below for details.

## Setup

### 1. Import Commands

Add the plugin to your Cypress support file:

```typescript
// cypress/support/e2e.ts (or cypress/support/e2e.js)
import '@a11y-oracle/cypress-plugin';
```

That's it. Importing the package registers all custom commands automatically.

### 2. Configure Browser

Ensure your Cypress config runs tests in Chrome:

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
});
```

Run with Chrome:

```bash
npx cypress run --browser chrome
```

## Usage

### Speech Assertions

```typescript
describe('My Form', () => {
  beforeEach(() => {
    cy.visit('/form.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('Tab navigates to submit button', () => {
    cy.a11yPress('Tab');
    cy.a11yPress('Tab');
    cy.a11yPress('Tab')
      .should('equal', 'Submit, button');
  });

  it('checkbox announces checked state', () => {
    cy.a11yPress('Tab');
    cy.a11yPress('Space')
      .should('contain', 'checkbox')
      .should('contain', 'checked');
  });
});
```

### Unified State (Speech + Focus + Indicator)

```typescript
it('Tab returns unified accessibility state', () => {
  cy.a11yPressKey('Tab').then((state) => {
    // Speech
    expect(state.speech).to.contain('Submit');
    expect(state.speechResult?.role).to.equal('button');

    // Focused element
    expect(state.focusedElement?.tag).to.equal('BUTTON');
    expect(state.focusedElement?.id).to.equal('submit-btn');

    // Focus indicator (WCAG 2.4.12 AA)
    expect(state.focusIndicator.isVisible).to.be.true;
    expect(state.focusIndicator.meetsWCAG_AA).to.be.true;
  });
});

it('Shift+Tab navigates backward', () => {
  cy.a11yPressKey('Tab');
  cy.a11yPressKey('Tab');
  cy.a11yPressKey('Tab', { shift: true }).then((state) => {
    expect(state.focusedElement).to.not.be.null;
  });
});
```

### Tab Order and Keyboard Trap Detection

```typescript
it('page has correct tab order', () => {
  cy.a11yTraverseTabOrder().then((report) => {
    expect(report.totalCount).to.be.greaterThan(0);
    expect(report.entries[0].tag).to.equal('A');
  });
});

it('modal does not trap keyboard focus', () => {
  cy.a11yTraverseSubTree('#modal-container', 20).then((result) => {
    expect(result.isTrapped).to.be.false;
    expect(result.escapeElement).to.not.be.null;
  });
});
```

### Issue Reporting

Check focus indicators and keyboard traps with automatic issue reporting. Issues are accumulated via `cy.task('logOracleIssues')` and can be written to a JSON report at the end of the run.

```typescript
describe('Accessibility audit', () => {
  beforeEach(() => {
    cy.visit('/my-page.html');
    cy.initA11yOracle();
  });

  afterEach(() => {
    cy.disposeA11yOracle();
  });

  it('focus indicators pass oracle rules', () => {
    cy.a11yPressKey('Tab');
    cy.a11yCheckFocusAndReport();   // checks + reports issues

    cy.a11yPressKey('Tab');
    cy.a11yCheckFocusAndReport();   // check each focused element
  });

  it('modal is not a keyboard trap', () => {
    cy.get('#open-modal').click();
    cy.a11yCheckTrapAndReport('#modal-dialog', 10);
  });
});
```

#### WCAG Level and Rule Configuration

Filter issues by WCAG conformance level or disable specific rules via Cypress env:

```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    env: {
      wcagLevel: 'wcag21aa',                       // WCAG 2.1 Level AA (default: 'wcag22aa')
      disabledRules: ['oracle/positive-tabindex'],  // Suppress specific rules
    },
  },
});
```

Supported `wcagLevel` values (matching axe-core tag format):
- `'wcag2a'` / `'wcag2aa'` — WCAG 2.0
- `'wcag21a'` / `'wcag21aa'` — WCAG 2.1
- `'wcag22a'` / `'wcag22aa'` — WCAG 2.2 (default)

Or override per-command:

```typescript
cy.a11yCheckFocusAndReport({ wcagLevel: 'wcag22a' });
cy.a11yCheckFocusAndReport({ disabledRules: ['oracle/focus-low-contrast'] });
```

Set `Cypress.env('failOnErrors')` to `true` to fail the test immediately when issues are found:

```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    env: { failOnErrors: true },
  },
});
```

For detailed remediation guidance on each rule, see the [Remediation Guide](../../docs/REMEDIATION.md).

### Node-Side Reporting Setup

To accumulate issues across all specs and write a JSON report file, call `setupOracleReporting()` in your Cypress config:

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';
import { setupOracleReporting } from '@a11y-oracle/cypress-plugin';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      setupOracleReporting(on, config);
    },
    env: { projectName: 'my-app' },
  },
});
```

This registers the `logOracleIssues` task and writes `oracle-results-{projectName}.json` after the run completes.

**Combining with axe-core violations:** If you want oracle issues in the same array as your axe-core violations (for a single upload to Beacon), add the task handler manually:

```typescript
setupNodeEvents(on, config) {
  const allViolations: any[] = [];

  on('task', {
    logAxeViolations(violations) { allViolations.push(...violations); return null; },
    logOracleIssues(issues) { allViolations.push(...issues); return null; },
  });

  on('after:run', () => {
    if (allViolations.length > 0) {
      fs.writeFileSync('a11y-results.json', JSON.stringify(allViolations, null, 2));
    }
  });
},
```

### Asserting on Landmarks and Structure

Use `getA11yFullTreeSpeech()` to inspect elements that don't have focus:

```typescript
it('navigation landmark exists', () => {
  cy.getA11yFullTreeSpeech().then((tree) => {
    const nav = tree.find(r => r.speech.includes('navigation landmark'));
    expect(nav).to.exist;
    expect(nav.speech).to.contain('Main');
  });
});
```

### Structured Speech Results

Use `getA11ySpeechResult()` to access individual parts of the speech output:

```typescript
it('returns structured data', () => {
  cy.a11yPress('Tab');
  cy.getA11ySpeechResult().then((result) => {
    expect(result).to.not.be.null;
    expect(result.name).to.equal('Home');
    expect(result.role).to.contain('menu item');
    expect(result.states).to.be.an('array');
    expect(result.rawNode).to.exist;
  });
});
```

### Configuration Options

Pass options to `initA11yOracle()` to customize behavior:

```typescript
// Include descriptions from aria-describedby
cy.initA11yOracle({ includeDescription: true });

// Disable "landmark" suffix on landmark roles
cy.initA11yOracle({ includeLandmarks: false });

// Adjust focus settle delay for slow CSS transitions
cy.initA11yOracle({ focusSettleMs: 100 });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeLandmarks` | `boolean` | `true` | Append "landmark" to landmark roles |
| `includeDescription` | `boolean` | `false` | Include `aria-describedby` text in output |
| `focusSettleMs` | `number` | `50` | Delay (ms) after key press for focus/CSS to settle |

## API Reference

### Speech Commands

#### `cy.initA11yOracle(options?)`

Initialize the plugin. Must be called after `cy.visit()` and before other A11y-Oracle commands. Typically called in `beforeEach()`.

Enables CDP domains, discovers the AUT iframe, creates the speech engine and orchestrator.

#### `cy.a11yPress(key)`

Press a keyboard key via CDP and return the speech for the newly focused element. Yields a string.

```typescript
cy.a11yPress('Tab').should('contain', 'button');
cy.a11yPress('Enter').should('contain', 'expanded');
cy.a11yPress('Escape').should('contain', 'collapsed');
```

Supported keys: `Tab`, `Enter`, `Space`, `Escape`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `Backspace`, `Delete`.

#### `cy.getA11ySpeech()`

Get the speech string for the currently focused element without pressing a key. Yields a string.

#### `cy.getA11ySpeechResult()`

Get the full structured result for the focused element. Yields `SpeechResult | null`.

#### `cy.getA11yFullTreeSpeech()`

Get speech for all non-ignored nodes in the accessibility tree. Yields `SpeechResult[]`.

### Unified State Commands

#### `cy.a11yPressKey(key, modifiers?)`

Press a key via native CDP dispatch and return the unified accessibility state. Yields `A11yState`.

```typescript
cy.a11yPressKey('Tab').then((state) => {
  expect(state.speech).to.contain('button');
  expect(state.focusIndicator.meetsWCAG_AA).to.be.true;
});

// With modifier keys
cy.a11yPressKey('Tab', { shift: true }).then((state) => {
  expect(state.focusedElement).to.not.be.null;
});
```

#### `cy.a11yState()`

Get the current unified accessibility state without pressing a key. Yields `A11yState`.

```typescript
cy.get('#my-button').focus();
cy.a11yState().then((state) => {
  expect(state.speech).to.contain('Submit');
});
```

#### `cy.a11yTraverseTabOrder()`

Extract all tabbable elements in DOM tab order. Yields `TabOrderReport`.

```typescript
cy.a11yTraverseTabOrder().then((report) => {
  expect(report.totalCount).to.be.greaterThan(0);
});
```

#### `cy.a11yTraverseSubTree(selector, maxTabs?)`

Detect whether a container traps keyboard focus (WCAG 2.1.2). Yields `TraversalResult`.

```typescript
cy.a11yTraverseSubTree('#modal', 20).then((result) => {
  expect(result.isTrapped).to.be.false;
});
```

### Reporting Commands

#### `cy.a11yCheckFocusAndReport(context?)`

Check the current focused element and report any issues via `cy.task('logOracleIssues')`. Runs all state-based rules: `oracle/focus-not-visible`, `oracle/focus-low-contrast`, `oracle/focus-missing-name`, `oracle/focus-generic-role`, and `oracle/positive-tabindex`.

- `context` — Optional `Partial<AuditContext>`. Defaults to `{ project: Cypress.env('projectName'), specName: Cypress.spec.name, wcagLevel: Cypress.env('wcagLevel'), disabledRules: Cypress.env('disabledRules') }`.

#### `cy.a11yCheckTrapAndReport(selector, maxTabs?, context?)`

Check a container for keyboard traps and report any issues via `cy.task('logOracleIssues')`.

- `selector` — CSS selector for the container to test.
- `maxTabs` — Maximum Tab presses before declaring a trap. Default `50`.
- `context` — Optional `Partial<AuditContext>`.

#### `setupOracleReporting(on, config)`

Node-side function (not a Cypress command). Call inside `setupNodeEvents()` to register the `logOracleIssues` task and write a JSON report in `after:run`. See [Node-Side Reporting Setup](#node-side-reporting-setup).

```typescript
import { setupOracleReporting } from '@a11y-oracle/cypress-plugin';
```

### CDP Adapter

#### `createCypressCDPAdapter()`

Create a ready-to-use `CDPSessionLike` adapter for custom integrations. This is useful when you need to call `@a11y-oracle/axe-bridge`'s `resolveAllIncomplete()` directly instead of using the built-in Cypress commands.

The function encapsulates all the CDP plumbing:
- Enables `DOM.enable` and `Page.enable` CDP domains
- Discovers the AUT frame ID from `Page.getFrameTree`
- Creates an isolated world execution context in the AUT frame
- Detects iframe position and CSS transform scale
- Returns a `CDPSessionLike` adapter with scale-aware `Page.captureScreenshot` coordinate translation

```typescript
import { createCypressCDPAdapter } from '@a11y-oracle/cypress-plugin';
import { resolveAllIncomplete } from '@a11y-oracle/axe-bridge';

// In your custom Cypress command:
cy.wrap(null).then(async () => {
  const cdp = await createCypressCDPAdapter();
  const resolved = await resolveAllIncomplete(cdp, axeResults, options);
});
```

### Lifecycle

#### `cy.disposeA11yOracle()`

Dispose the plugin and release CDP resources. Typically called in `afterEach()`.

### Types

Types are re-exported from `@a11y-oracle/core-engine` and `@a11y-oracle/audit-formatter`:

```typescript
import type {
  // Core engine types
  CDPSessionLike,
  SpeechResult,
  A11yState,
  A11yFocusedElement,
  A11yFocusIndicator,
  A11yOrchestratorOptions,
  ModifierKeys,
  TabOrderReport,
  TabOrderEntry,
  TraversalResult,
  FocusIndicator,
  // Audit formatter types
  OracleIssue,
  OracleNode,
  OracleCheck,
  OracleImpact,
  OracleResultType,
  AuditContext,
} from '@a11y-oracle/cypress-plugin';
```

## How It Works

The Cypress plugin uses a browser-side CDP approach through `Cypress.automation('remote:debugger:protocol')` — the same pattern used by [cypress-real-events](https://github.com/dmtrKovalenko/cypress-real-events). No Node-side tasks or external libraries are required.

### Cypress Iframe Architecture

Cypress runs the app under test (AUT) inside an iframe within its runner page. This creates a challenge: CDP commands target the runner page by default, not the AUT. The plugin handles this transparently:

1. **Frame discovery** — On `initA11yOracle()`, the plugin calls `Page.getFrameTree()` to enumerate all frames. It identifies the AUT frame by filtering out Cypress internal frames (`/__/`, `__cypress`, `about:blank`).

2. **Frame-scoped accessibility queries** — A CDP adapter injects the AUT `frameId` into every `Accessibility.getFullAXTree()` call, ensuring the accessibility tree is scoped to the app, not the runner UI.

3. **Isolated execution context** — For `Runtime.evaluate` calls (focus indicator analysis, tab order, trap detection), the plugin creates an isolated world in the AUT frame via `Page.createIsolatedWorld`. This isolated world shares the same DOM (including `document.activeElement`, computed styles, etc.) but has its own JavaScript scope, ensuring evaluations target the AUT content.

4. **Screenshot coordinate translation** — `getBoundingClientRect()` inside the AUT iframe returns iframe-relative coordinates, but `Page.captureScreenshot` clips from the top-level browser viewport. The plugin queries the AUT iframe's position in the viewport and offsets all screenshot clip coordinates accordingly. It also detects the CSS transform scale that Cypress applies to the AUT iframe wrapper (typically ~0.66x in headless Electron), and applies it to coordinates, dimensions, and the clip's `scale` property. This ensures pixel-level analysis (color contrast, focus indicator diffing) captures the correct region even when the AUT is rendered at a scaled size.

5. **Focus management** — Before each keyboard event, the plugin uses `DOM.focus()` on the AUT iframe element so that `Input.dispatchKeyEvent` reaches the correct frame.

### CDP Flow

```
cy.a11yPressKey('Tab')
  │
  ├─ DOM.focus() on AUT iframe
  ├─ Input.dispatchKeyEvent (keyDown + keyUp)
  ├─ 50ms delay for focus/ARIA state updates
  ├─ Accessibility.getFullAXTree({ frameId: autFrameId })
  ├─ Runtime.evaluate({ contextId: autContextId }) — focused element
  ├─ Runtime.evaluate({ contextId: autContextId }) — focus indicator CSS
  ├─ Find focused node in AXTree → speech string
  └─ Assemble A11yState { speech, focusedElement, focusIndicator }
```

## TypeScript

The plugin augments the `Cypress.Chainable` interface. TypeScript will pick up the command types automatically when you import the plugin in your support file.

If you need types in your test files without importing the support file:

```typescript
/// <reference types="@a11y-oracle/cypress-plugin" />
```

## Known Limitations

### CDP Resource Accumulation in Long Test Suites

Cypress runs the application under test (AUT) inside an iframe within its runner page. To interact with the AUT's accessibility tree, the plugin must create an **isolated execution world** in the AUT frame via `Page.createIsolatedWorld` on every `initA11yOracle()` call. Unlike Playwright — which provides native, first-class CDP sessions — Cypress's iframe architecture means these isolated worlds accumulate browser-side resources that Chrome does not fully reclaim, even after `disposeA11yOracle()` cleans up its own references.

**What this means in practice:**

- Test suites with many spec files or many tests per file may experience increasing memory pressure over the course of a run.
- In v1.3.0 and earlier, this caused a deterministic hang after approximately 16 `init`/`dispose` cycles, because `Accessibility.getFullAXTree` would stall when traversing nodes across all accumulated contexts ([#14](https://github.com/a11y-oracle/a11y-oracle/issues/14)).
- v1.3.1 mitigated the hang by properly destroying isolated worlds on dispose, but the underlying architectural constraint — that Cypress proxies all CDP calls through its runner and manages frame contexts differently than Playwright — remains.

**Recommendation:** If you are starting a new project or have the flexibility to choose your E2E framework, use [`@a11y-oracle/playwright-plugin`](../playwright-plugin/README.md). Playwright provides direct CDP session access without iframe indirection, making it inherently more stable and performant for A11y-Oracle's CDP-heavy workflow.

If you need to stay on Cypress, the plugin is fully functional — just be aware of these constraints for very large suites.

## Troubleshooting

### "Could not find the AUT iframe"

This error means `initA11yOracle()` was called before `cy.visit()`. The AUT iframe doesn't exist until Cypress loads a page.

```typescript
// Wrong
cy.initA11yOracle();
cy.visit('/page.html');

// Correct
cy.visit('/page.html');
cy.initA11yOracle();
```

### Speech output contains Cypress UI elements

If assertions match Cypress runner elements (like "Stop, button" or "Options, button"), the frame-scoping may have failed. Ensure:

- You're running in Chrome (`--browser chrome`)
- `cy.visit()` completed before `cy.initA11yOracle()`
- The AUT URL is not `about:blank`

### Empty speech string

`a11yPress()` returns an empty string when no element has focus after the key press. This can happen if:

- The key press moved focus outside the page (e.g., Tab past the last element)
- The focused element has `role="presentation"` or `role="none"`
- The focused element is the `RootWebArea` (document body)

### Focus indicator shows `contrastRatio: null`

This happens when the focus indicator color cannot be reliably parsed. Common causes:

- Complex CSS color functions (`color-mix()`, `hsl()`, named colors)
- Multi-layer gradients as focus indicators
- `currentColor` as outline color

For the full list of role and state mappings, see the [@a11y-oracle/core-engine README](../core-engine/README.md).
