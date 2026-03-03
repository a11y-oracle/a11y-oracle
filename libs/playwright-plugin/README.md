# @a11y-oracle/playwright-plugin

Playwright integration for A11y-Oracle. Provides a test fixture and wrapper class that reads the browser's Accessibility Tree via Chrome DevTools Protocol, dispatches native keyboard events, and analyzes visual focus indicators.

```typescript
import { test, expect } from '@a11y-oracle/playwright-plugin';

test('dropdown button announces correctly', async ({ page, a11y }) => {
  await page.goto('/dropdown-nav.html');

  const speech = await a11y.press('Tab');
  expect(speech).toContain('Home');
  expect(speech).toContain('menu item');
});
```

## Installation

```bash
npm install -D @a11y-oracle/playwright-plugin @a11y-oracle/core-engine @playwright/test
```

> **Chromium only.** CDP sessions are not available for Firefox or WebKit in Playwright.

## Usage

### Test Fixture (Recommended)

The plugin exports an extended `test` function that injects an `a11y` fixture. The CDP session is created before each test and cleaned up automatically after.

```typescript
import { test, expect } from '@a11y-oracle/playwright-plugin';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-page.html');
  });

  test('Tab to button announces name and role', async ({ a11y }) => {
    const speech = await a11y.press('Tab');
    expect(speech).toBe('Submit, button');
  });

  test('checkbox announces checked state', async ({ a11y }) => {
    await a11y.press('Tab');
    await a11y.press('Tab');
    const speech = await a11y.press('Space');
    expect(speech).toContain('checkbox');
    expect(speech).toContain('checked');
  });

  test('navigation landmark exists', async ({ a11y }) => {
    const tree = await a11y.getFullTreeSpeech();
    const nav = tree.find(r => r.speech.includes('navigation landmark'));
    expect(nav).toBeDefined();
  });
});
```

### Unified State API

The `pressKey()` method returns a complete `A11yState` snapshot combining speech output, focused element info, and focus indicator analysis:

```typescript
test('focus indicator meets WCAG 2.4.12 AA', async ({ page, a11y }) => {
  await page.goto('/my-page.html');

  const state = await a11y.pressKey('Tab');

  // Speech
  expect(state.speech).toContain('Submit');
  expect(state.speechResult?.role).toBe('button');

  // Focused element
  expect(state.focusedElement?.tag).toBe('BUTTON');
  expect(state.focusedElement?.id).toBe('submit-btn');
  expect(state.focusedElement?.tabIndex).toBe(0);

  // Focus indicator CSS analysis
  expect(state.focusIndicator.isVisible).toBe(true);
  expect(state.focusIndicator.contrastRatio).toBeGreaterThanOrEqual(3.0);
  expect(state.focusIndicator.meetsWCAG_AA).toBe(true);
});

test('Shift+Tab navigates backward', async ({ page, a11y }) => {
  await page.goto('/my-page.html');

  await a11y.pressKey('Tab');
  const state1 = await a11y.pressKey('Tab');
  const state2 = await a11y.pressKey('Tab', { shift: true });

  expect(state2.focusedElement?.id).toBe(state1.focusedElement?.id);
});
```

### Tab Order and Keyboard Trap Detection

```typescript
test('page has correct tab order', async ({ page, a11y }) => {
  await page.goto('/my-page.html');

  const report = await a11y.traverseTabOrder();
  expect(report.totalCount).toBeGreaterThan(0);
  expect(report.entries[0].tag).toBe('A');
});

test('modal does not trap keyboard focus', async ({ page, a11y }) => {
  await page.goto('/modal.html');

  const result = await a11y.traverseSubTree('#modal-container', 20);
  expect(result.isTrapped).toBe(false);
  expect(result.escapeElement).not.toBeNull();
});
```

### Audit and Issue Reporting

Use `OracleAuditor` from `@a11y-oracle/audit-formatter` to automatically check WCAG rules on every interaction and accumulate any issues:

```bash
npm install -D @a11y-oracle/audit-formatter
```

```typescript
import { test, expect } from '@a11y-oracle/playwright-plugin';
import { OracleAuditor } from '@a11y-oracle/audit-formatter';

test('all focus indicators pass oracle rules', async ({ page, a11y }) => {
  await page.goto('/my-page.html');

  const auditor = new OracleAuditor(a11y, {
    project: 'my-app',
    specName: 'navigation.spec.ts',
  });

  // Each pressKey() automatically checks focus-not-visible + focus-low-contrast
  await auditor.pressKey('Tab');
  await auditor.pressKey('Tab');
  await auditor.pressKey('Tab');

  // checkTrap() automatically checks keyboard-trap
  await auditor.checkTrap('#modal-container');

  // Assert no issues found across all interactions
  expect(auditor.getIssues()).toHaveLength(0);
});
```

To write issues to a JSON report file at the end of the suite:

```typescript
import { test } from '@a11y-oracle/playwright-plugin';
import { OracleAuditor, type OracleIssue } from '@a11y-oracle/audit-formatter';
import * as fs from 'fs';

const allIssues: OracleIssue[] = [];

test('check page focus indicators', async ({ page, a11y }) => {
  await page.goto('/my-page.html');
  const auditor = new OracleAuditor(a11y, {
    project: 'my-app',
    specName: 'nav.spec.ts',
  });

  await auditor.pressKey('Tab');
  await auditor.pressKey('Tab');
  allIssues.push(...auditor.getIssues());
});

test.afterAll(() => {
  if (allIssues.length > 0) {
    fs.writeFileSync('oracle-results.json', JSON.stringify(allIssues, null, 2));
  }
});
```

For detailed remediation guidance on each rule, see the [Remediation Guide](../../docs/REMEDIATION.md).

### Customizing Options

Override speech engine options per test group using `test.use()`:

```typescript
test.describe('without landmark suffix', () => {
  test.use({ a11yOptions: { includeLandmarks: false } });

  test('nav role without landmark', async ({ page, a11y }) => {
    await page.goto('/my-page.html');
    const tree = await a11y.getFullTreeSpeech();
    const nav = tree.find(r => r.role === 'navigation');
    expect(nav?.speech).toBe('Main, navigation');
  });
});
```

Available options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeLandmarks` | `boolean` | `true` | Append "landmark" to landmark roles |
| `includeDescription` | `boolean` | `false` | Include `aria-describedby` text in output |
| `focusSettleMs` | `number` | `50` | Delay (ms) after key press for focus/CSS to settle |

### Manual Usage

If you need more control over the lifecycle (e.g., attaching to a specific page mid-test), use the `A11yOracle` class directly:

```typescript
import { A11yOracle } from '@a11y-oracle/playwright-plugin';
import { test, expect } from '@playwright/test';

test('manual setup', async ({ page }) => {
  await page.goto('/my-page.html');

  const a11y = new A11yOracle(page, { includeDescription: true });
  await a11y.init();

  const speech = await a11y.press('Tab');
  expect(speech).toContain('button');

  await a11y.dispose();
});
```

## API Reference

### `A11yOracle`

Manages a CDP session and provides accessibility testing for the current page.

#### `constructor(page: Page, options?: A11yOrchestratorOptions)`

Create a new instance.

- `page` — Playwright `Page` to attach to.
- `options.includeLandmarks` — Append "landmark" to landmark roles. Default `true`.
- `options.includeDescription` — Include description text. Default `false`.
- `options.focusSettleMs` — Delay after key press for focus/CSS to settle. Default `50`.

#### `init(): Promise<void>`

Open a CDP session and enable the Accessibility domain. Must be called before any other method. The test fixture calls this automatically.

#### Speech-Only API

##### `press(key: string): Promise<string>`

Press a keyboard key (via Playwright's `page.keyboard.press()`) and return the speech for the newly focused element. Returns an empty string if no element has focus.

```typescript
const speech = await a11y.press('Tab');
// "Products, button, collapsed"
```

##### `getSpeech(): Promise<string>`

Get the speech string for the currently focused element without pressing a key.

##### `getSpeechResult(): Promise<SpeechResult | null>`

Get the full structured result for the focused element.

##### `getFullTreeSpeech(): Promise<SpeechResult[]>`

Get speech for all non-ignored nodes in the accessibility tree.

#### Unified State API

##### `pressKey(key: string, modifiers?: ModifierKeys): Promise<A11yState>`

Dispatch a key via native CDP `Input.dispatchKeyEvent` and return the unified accessibility state. Unlike `press()`, this uses hardware-level key dispatch and returns the full state.

```typescript
const state = await a11y.pressKey('Tab');
// state.speech           → "Products, button, collapsed"
// state.focusedElement   → { tag: 'BUTTON', id: '...', ... }
// state.focusIndicator   → { isVisible: true, meetsWCAG_AA: true, ... }
```

##### `getA11yState(): Promise<A11yState>`

Get the current unified state without pressing a key.

```typescript
await page.focus('#my-button');
const state = await a11y.getA11yState();
```

##### `traverseTabOrder(): Promise<TabOrderReport>`

Extract all tabbable elements in DOM tab order.

##### `traverseSubTree(selector: string, maxTabs?: number): Promise<TraversalResult>`

Detect whether a container traps keyboard focus (WCAG 2.1.2).

#### Lifecycle

##### `dispose(): Promise<void>`

Detach the CDP session and free resources. The test fixture calls this automatically.

### Test Fixture

The `test` export extends Playwright's `test` with two fixtures:

| Fixture | Type | Description |
|---------|------|-------------|
| `a11y` | `A11yOracle` | Initialized instance, auto-disposed after each test |
| `a11yOptions` | `A11yOrchestratorOptions` | Override via `test.use()` |

### Exports

```typescript
// Test fixture (recommended)
export { test, expect } from '@a11y-oracle/playwright-plugin';

// Manual usage
export { A11yOracle } from '@a11y-oracle/playwright-plugin';

// Fixture types
export type { A11yOracleFixtures } from '@a11y-oracle/playwright-plugin';

// Re-exported types from core-engine
export type {
  A11yState,
  A11yFocusedElement,
  A11yFocusIndicator,
  A11yOrchestratorOptions,
  SpeechResult,
  SpeechEngineOptions,
  ModifierKeys,
  TabOrderReport,
  TabOrderEntry,
  TraversalResult,
  FocusIndicator,
} from '@a11y-oracle/playwright-plugin';
```

## Playwright Config

The plugin requires Chromium. A typical `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://localhost:4200',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
});
```

## How It Works

1. The fixture opens a CDP session via `page.context().newCDPSession(page)`
2. It creates both a `SpeechEngine` and an `A11yOrchestrator` on that session
3. **`press(key)`** — Uses Playwright's keyboard API, waits 50ms, then reads the AXTree for speech
4. **`pressKey(key)`** — Uses native CDP `Input.dispatchKeyEvent` for hardware-level dispatch, waits `focusSettleMs`, then collects speech + focused element + focus indicator in parallel
5. Focus indicator analysis runs `Runtime.evaluate` to read computed CSS styles and calculate contrast ratios
6. On dispose, the CDP session is detached

The speech format follows: `[Computed Name], [Role], [State/Properties]`

For the full list of role and state mappings, see the [@a11y-oracle/core-engine README](../core-engine/README.md).
