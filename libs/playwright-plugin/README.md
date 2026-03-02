# @a11y-oracle/playwright-plugin

Playwright integration for A11y-Oracle. Provides a test fixture and wrapper class that reads the browser's Accessibility Tree via Chrome DevTools Protocol and returns standardized speech output.

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

### Customizing Options

Override speech engine options per test group using `test.use()`:

```typescript
test.describe('without landmark suffix', () => {
  test.use({ a11yOptions: { includeLandmarks: false } });

  test('nav role without landmark', async ({ page, a11y }) => {
    await page.goto('/my-page.html');
    const tree = await a11y.getFullTreeSpeech();
    const nav = tree.find(r => r.role === 'navigation');
    // Without includeLandmarks, role is "navigation" instead of "navigation landmark"
    expect(nav?.speech).toBe('Main, navigation');
  });
});
```

Available options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeLandmarks` | `boolean` | `true` | Append "landmark" to landmark roles |
| `includeDescription` | `boolean` | `false` | Include `aria-describedby` text in output |

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

Manages a CDP session and provides accessibility speech output for the current page.

#### `constructor(page: Page, options?: SpeechEngineOptions)`

Create a new instance.

- `page` -- Playwright `Page` to attach to.
- `options.includeLandmarks` -- Append "landmark" to landmark roles. Default `true`.
- `options.includeDescription` -- Include description text. Default `false`.

#### `init(): Promise<void>`

Open a CDP session and enable the Accessibility domain. Must be called before any other method. The test fixture calls this automatically.

#### `press(key: string): Promise<string>`

Press a keyboard key and return the speech for the newly focused element. Uses Playwright's `page.keyboard.press()` internally, followed by a short delay for focus/ARIA state updates.

```typescript
const speech = await a11y.press('Tab');
// "Products, button, collapsed"
```

Returns an empty string if no element has focus after the key press.

#### `getSpeech(): Promise<string>`

Get the speech string for the currently focused element without pressing a key.

```typescript
await page.focus('#my-button');
const speech = await a11y.getSpeech();
// "Submit, button"
```

#### `getSpeechResult(): Promise<SpeechResult | null>`

Get the full structured result for the focused element. Returns `null` if no element has focus.

```typescript
const result = await a11y.getSpeechResult();
if (result) {
  console.log(result.speech);  // "Products, button, collapsed"
  console.log(result.name);    // "Products"
  console.log(result.role);    // "button"
  console.log(result.states);  // ["collapsed"]
  console.log(result.rawNode); // Full CDP AXNode
}
```

#### `getFullTreeSpeech(): Promise<SpeechResult[]>`

Get speech for all non-ignored nodes in the accessibility tree. Useful for asserting on landmarks, headings, or structural elements that don't have focus.

```typescript
const all = await a11y.getFullTreeSpeech();
const headings = all.filter(r => r.role.includes('heading'));
const landmarks = all.filter(r => r.role.includes('landmark'));
```

#### `dispose(): Promise<void>`

Detach the CDP session and free resources. The test fixture calls this automatically.

### Test Fixture

The `test` export extends Playwright's `test` with two fixtures:

| Fixture | Type | Description |
|---------|------|-------------|
| `a11y` | `A11yOracle` | Initialized instance, auto-disposed after each test |
| `a11yOptions` | `SpeechEngineOptions` | Override via `test.use()` |

### Exports

```typescript
// Test fixture (recommended)
export { test, expect } from '@a11y-oracle/playwright-plugin';

// Manual usage
export { A11yOracle } from '@a11y-oracle/playwright-plugin';

// Fixture types
export type { A11yOracleFixtures } from '@a11y-oracle/playwright-plugin';
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
2. It enables the `Accessibility` domain on that session
3. On `press(key)`, Playwright sends the key event and waits 50ms for focus/ARIA updates
4. The engine calls `Accessibility.getFullAXTree()` to fetch the full accessibility tree
5. It finds the focused node and maps its role, name, and states to a speech string
6. On dispose, the CDP session is detached

The speech format follows: `[Computed Name], [Role], [State/Properties]`

For the full list of role and state mappings, see the [@a11y-oracle/core-engine README](../core-engine/README.md).
