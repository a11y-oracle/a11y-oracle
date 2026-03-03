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

### Lifecycle

#### `cy.disposeA11yOracle()`

Dispose the plugin and release CDP resources. Typically called in `afterEach()`.

### Types

All types are re-exported from `@a11y-oracle/core-engine`:

```typescript
import type {
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
} from '@a11y-oracle/cypress-plugin';
```

## How It Works

The Cypress plugin uses a browser-side CDP approach through `Cypress.automation('remote:debugger:protocol')` — the same pattern used by [cypress-real-events](https://github.com/dmtrKovalenko/cypress-real-events). No Node-side tasks or external libraries are required.

### Cypress Iframe Architecture

Cypress runs the app under test (AUT) inside an iframe within its runner page. This creates a challenge: CDP commands target the runner page by default, not the AUT. The plugin handles this transparently:

1. **Frame discovery** — On `initA11yOracle()`, the plugin calls `Page.getFrameTree()` to enumerate all frames. It identifies the AUT frame by filtering out Cypress internal frames (`/__/`, `__cypress`, `about:blank`).

2. **Frame-scoped accessibility queries** — A CDP adapter injects the AUT `frameId` into every `Accessibility.getFullAXTree()` call, ensuring the accessibility tree is scoped to the app, not the runner UI.

3. **Isolated execution context** — For `Runtime.evaluate` calls (focus indicator analysis, tab order, trap detection), the plugin creates an isolated world in the AUT frame via `Page.createIsolatedWorld`. This isolated world shares the same DOM (including `document.activeElement`, computed styles, etc.) but has its own JavaScript scope, ensuring evaluations target the AUT content.

4. **Focus management** — Before each keyboard event, the plugin uses `DOM.focus()` on the AUT iframe element so that `Input.dispatchKeyEvent` reaches the correct frame.

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
