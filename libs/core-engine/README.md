# @a11y-oracle/core-engine

Framework-agnostic accessibility engine for A11y-Oracle. Provides two main APIs:

1. **`SpeechEngine`** — Reads the browser's Accessibility Tree via CDP and generates standardized speech output.
2. **`A11yOrchestrator`** — Unified orchestrator that combines speech, keyboard dispatch, and focus indicator analysis into a single `pressKey()` call.

This package is the foundation that the Playwright and Cypress plugins build on. You can also use it directly with any CDP-compatible client.

## Installation

```bash
npm install @a11y-oracle/core-engine
```

## Usage

### SpeechEngine (Speech Only)

The speech engine operates through a `CDPSessionLike` interface, which any CDP client can satisfy:

```typescript
import { SpeechEngine } from '@a11y-oracle/core-engine';

// Works with Playwright's CDPSession
const cdpSession = await page.context().newCDPSession(page);
const engine = new SpeechEngine(cdpSession);
await engine.enable();

// Get speech for the currently focused element
const result = await engine.getSpeech();
console.log(result?.speech); // "Products, button, collapsed"

// Get speech for every visible element
const all = await engine.getFullTreeSpeech();
const nav = all.find(r => r.speech.includes('navigation landmark'));

// Clean up
await engine.disable();
```

### A11yOrchestrator (Unified State)

The orchestrator coordinates the speech engine, keyboard engine, and focus analyzer:

```typescript
import { A11yOrchestrator } from '@a11y-oracle/core-engine';

const cdpSession = await page.context().newCDPSession(page);
const orchestrator = new A11yOrchestrator(cdpSession);
await orchestrator.enable();

// Press a key and get unified state
const state = await orchestrator.pressKey('Tab');
console.log(state.speech);                       // "Products, button, collapsed"
console.log(state.focusedElement?.tag);           // "BUTTON"
console.log(state.focusIndicator.meetsWCAG_AA);  // true

// Get state without pressing a key
const current = await orchestrator.getState();

// Tab order extraction
const report = await orchestrator.traverseTabOrder();
console.log(report.totalCount);  // 12

// Keyboard trap detection (WCAG 2.1.2)
const result = await orchestrator.traverseSubTree('#modal', 20);
console.log(result.isTrapped);  // false

await orchestrator.disable();
```

### Configuration Options

```typescript
const engine = new SpeechEngine(cdpSession, {
  // Include "landmark" suffix on landmark roles (default: true)
  // true:  "Main, navigation landmark"
  // false: "Main, navigation"
  includeLandmarks: true,

  // Include accessible descriptions in output (default: false)
  // true:  "Submit, button, Submits the form"
  // false: "Submit, button"
  includeDescription: false,
});

const orchestrator = new A11yOrchestrator(cdpSession, {
  // All SpeechEngine options, plus:

  // Milliseconds to wait after key press for focus/CSS to settle (default: 50)
  focusSettleMs: 50,
});
```

## API Reference

### `SpeechEngine`

The speech engine. All methods are async and operate through the CDP session.

#### `constructor(cdp: CDPSessionLike, options?: SpeechEngineOptions)`

Create a new engine instance.

- `cdp` — Any object implementing the `CDPSessionLike` interface.
- `options.includeLandmarks` — Append "landmark" to landmark roles. Default `true`.
- `options.includeDescription` — Include `aria-describedby` text. Default `false`.

#### `enable(): Promise<void>`

Enable the CDP Accessibility domain. Must be called before any other method.

#### `disable(): Promise<void>`

Disable the CDP Accessibility domain. Call when done to free browser resources.

#### `getSpeech(): Promise<SpeechResult | null>`

Get the speech output for the currently focused element.

Returns `null` if no element has focus or the focused element is ignored (e.g., `role="presentation"`).

```typescript
const result = await engine.getSpeech();
if (result) {
  console.log(result.speech);  // "Products, button, collapsed"
  console.log(result.name);    // "Products"
  console.log(result.role);    // "button"
  console.log(result.states);  // ["collapsed"]
  console.log(result.rawNode); // Full CDP AXNode object
}
```

#### `getFullTreeSpeech(): Promise<SpeechResult[]>`

Get speech for all non-ignored, non-silent nodes in the accessibility tree. Useful for asserting on landmarks, headings, or structural elements that don't have focus.

```typescript
const all = await engine.getFullTreeSpeech();
const headings = all.filter(r => r.role.includes('heading'));
const landmarks = all.filter(r => r.role.includes('landmark'));
```

#### `computeSpeech(node: AXNode): SpeechResult | null`

Compute speech for a single AXNode. Returns `null` for ignored or silent nodes.

#### `findFocusedNode(nodes: AXNode[]): AXNode | null`

Find the most specific focused node in the flat AXTree array. When multiple nodes report `focused: true` (e.g., `RootWebArea` and a `menuitem`), the deepest node is returned.

### `A11yOrchestrator`

Unified orchestrator coordinating three sub-engines:

| Engine | Responsibility |
|--------|---------------|
| `SpeechEngine` | AXTree to speech string |
| `KeyboardEngine` | CDP key dispatch + `document.activeElement` |
| `FocusAnalyzer` | CSS focus indicator + tab order + trap detection |

#### `constructor(cdp: CDPSessionLike, options?: A11yOrchestratorOptions)`

Create a new orchestrator.

- `cdp` — Any CDP-compatible session.
- `options.includeLandmarks` — Append "landmark" to landmark roles. Default `true`.
- `options.includeDescription` — Include description text. Default `false`.
- `options.focusSettleMs` — Delay after key press for focus/CSS to settle. Default `50`.

#### `enable(): Promise<void>`

Enable the CDP Accessibility domain. Must be called before other methods.

#### `disable(): Promise<void>`

Disable the CDP Accessibility domain.

#### `pressKey(key: string, modifiers?: ModifierKeys): Promise<A11yState>`

Dispatch a key press and return the unified accessibility state.

1. Sends `keyDown` + `keyUp` via CDP `Input.dispatchKeyEvent`
2. Waits `focusSettleMs` for CSS transitions and focus events
3. Collects speech, focused element, and focus indicator in parallel

```typescript
const state = await orchestrator.pressKey('Tab');
// state.speech           → "Products, button, collapsed"
// state.focusedElement   → { tag: 'BUTTON', id: 'products-btn', ... }
// state.focusIndicator   → { isVisible: true, contrastRatio: 12.5, meetsWCAG_AA: true }

// With modifier keys
const prev = await orchestrator.pressKey('Tab', { shift: true });
```

#### `getState(): Promise<A11yState>`

Get the current unified state without pressing a key. Useful after programmatic focus changes.

```typescript
await page.focus('#my-button');
const state = await orchestrator.getState();
```

#### `traverseTabOrder(): Promise<TabOrderReport>`

Extract all tabbable elements in DOM tab order.

```typescript
const report = await orchestrator.traverseTabOrder();
console.log(report.totalCount);     // 12
console.log(report.entries[0].tag); // "A"
console.log(report.entries[0].id);  // "home-link"
```

#### `traverseSubTree(selector: string, maxTabs?: number): Promise<TraversalResult>`

Detect whether a container traps keyboard focus (WCAG 2.1.2).

Focuses the first tabbable element in the container, presses Tab up to `maxTabs` times (default 50), and checks whether focus ever escapes.

```typescript
const result = await orchestrator.traverseSubTree('#modal-container', 20);
if (result.isTrapped) {
  console.log('Keyboard trap detected!');
  console.log(`Focus visited ${result.visitedElements.length} elements`);
} else {
  console.log(`Focus escaped to: ${result.escapeElement?.tag}`);
}
```

### Types

#### `CDPSessionLike`

The abstraction boundary between the engine and test frameworks:

```typescript
interface CDPSessionLike {
  send(method: 'Accessibility.enable'): Promise<void>;
  send(method: 'Accessibility.disable'): Promise<void>;
  send(
    method: 'Accessibility.getFullAXTree',
    params?: { depth?: number; frameId?: string }
  ): Promise<{ nodes: AXNode[] }>;
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}
```

Both Playwright's `CDPSession` and `chrome-remote-interface` clients satisfy this interface without adapters.

#### `SpeechResult`

Returned by `getSpeech()` and `getFullTreeSpeech()`:

```typescript
interface SpeechResult {
  speech: string;              // "Products, button, collapsed"
  name: string;                // "Products"
  role: string;                // "button"
  states: string[];            // ["collapsed"]
  rawNode: Protocol.Accessibility.AXNode;
}
```

#### `A11yState`

Returned by `pressKey()` and `getState()`:

```typescript
interface A11yState {
  speech: string;                          // "Products, button, collapsed"
  speechResult: SpeechResult | null;       // Full speech result with raw AXNode
  focusedElement: A11yFocusedElement | null; // DOM info
  focusIndicator: A11yFocusIndicator;      // CSS analysis
}
```

#### `A11yFocusedElement`

```typescript
interface A11yFocusedElement {
  tag: string;        // "BUTTON"
  id: string;         // "submit-btn"
  className: string;  // "btn primary"
  textContent: string; // "Submit"
  role: string;       // "button"
  ariaLabel: string;  // "Submit form"
  tabIndex: number;   // 0
  rect: { x: number; y: number; width: number; height: number };
}
```

#### `A11yFocusIndicator`

```typescript
interface A11yFocusIndicator {
  isVisible: boolean;           // true if outline or box-shadow detected
  contrastRatio: number | null; // null if colors unparseable
  meetsWCAG_AA: boolean;        // true if visible and contrast >= 3.0
}
```

#### `ModifierKeys`

```typescript
interface ModifierKeys {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}
```

#### `TabOrderReport`

```typescript
interface TabOrderReport {
  entries: TabOrderEntry[];
  totalCount: number;
}
```

#### `TabOrderEntry`

```typescript
interface TabOrderEntry {
  index: number;     // Position in tab order (0-based)
  tag: string;       // "BUTTON"
  id: string;        // "submit-btn"
  textContent: string;
  tabIndex: number;
  role: string;
  rect: { x: number; y: number; width: number; height: number };
}
```

#### `TraversalResult`

```typescript
interface TraversalResult {
  isTrapped: boolean;                  // true if focus never escaped
  tabCount: number;                    // Total Tab presses attempted
  visitedElements: TabOrderEntry[];    // Elements that received focus
  escapeElement: TabOrderEntry | null; // First element outside container
}
```

## Role Mappings

The `ROLE_TO_SPEECH` record maps 50+ CDP role values to speech strings. Roles are grouped into four categories:

### Interactive Roles

| CDP Role | Speech |
|----------|--------|
| `button` | `button` |
| `link` | `link` |
| `checkbox` | `checkbox` |
| `radio` | `radio button` |
| `textbox` | `edit text` |
| `combobox` | `combo box` |
| `slider` | `slider` |
| `switch` | `switch` |
| `tab` | `tab` |
| `menuitem` | `menu item` |
| `menuitemcheckbox` | `menu item checkbox` |
| `menuitemradio` | `menu item radio` |
| `option` | `option` |
| `searchbox` | `search text` |
| `spinbutton` | `spin button` |

### Landmark Roles

Landmarks automatically append "landmark" when `includeLandmarks` is `true`:

| CDP Role | Speech |
|----------|--------|
| `navigation` | `navigation landmark` |
| `main` | `main landmark` |
| `banner` | `banner landmark` |
| `contentinfo` | `content info landmark` |
| `complementary` | `complementary landmark` |
| `search` | `search landmark` |
| `region` | `region landmark` |
| `form` | `form landmark` |

### Structure Roles

| CDP Role | Speech |
|----------|--------|
| `heading` | `heading` |
| `list` | `list` |
| `listitem` | `list item` |
| `img` | `image` |
| `table` | `table` |
| `row` | `row` |
| `cell` | `cell` |
| `dialog` | `dialog` |
| `alert` | `alert` |
| `menu` | `menu` |
| `menubar` | `menu bar` |
| `toolbar` | `toolbar` |
| `tree` | `tree` |
| `treeitem` | `tree item` |
| `tablist` | `tab list` |
| `tabpanel` | `tab panel` |
| `progressbar` | `progress bar` |
| `tooltip` | `tooltip` |

### Silent Roles

These roles produce no speech output:

`generic`, `none`, `presentation`, `StaticText`, `InlineTextBox`, `LineBreak`, `RootWebArea`, `WebArea`, `paragraph`, `DescriptionListDetail`, `DescriptionListTerm`, `DescriptionList`

Unknown roles pass through as-is for forward compatibility with new ARIA roles.

## State Mappings

The `STATE_MAPPINGS` array defines how boolean ARIA properties translate to spoken strings. States appear in the output in the order listed below:

| CDP Property | `true` | `false` |
|-------------|--------|---------|
| `expanded` | `expanded` | `collapsed` |
| `checked` | `checked` | `not checked` |
| `selected` | `selected` | *(silent)* |
| `pressed` | `pressed` | `not pressed` |
| `disabled` | `dimmed` | *(silent)* |
| `required` | `required` | *(silent)* |
| `invalid` | `invalid` | *(silent)* |
| `readonly` | `read only` | *(silent)* |
| `multiselectable` | `multi selectable` | *(silent)* |

Heading levels are a special case: `level` property produces `level N` (e.g., `level 2`).

When multiple states are present, they are joined in the fixed order above:

```
"Submit, button, expanded, required"
"Email, edit text, invalid, required"
```

## Exports

```typescript
// Main classes
export { SpeechEngine } from '@a11y-oracle/core-engine';
export { A11yOrchestrator } from '@a11y-oracle/core-engine';

// Core types
export type {
  CDPSessionLike,
  SpeechResult,
  SpeechEngineOptions,
  A11yState,
  A11yFocusedElement,
  A11yFocusIndicator,
  A11yOrchestratorOptions,
} from '@a11y-oracle/core-engine';

// Data (for advanced customization)
export { ROLE_TO_SPEECH, LANDMARK_ROLES } from '@a11y-oracle/core-engine';
export { STATE_MAPPINGS, extractStates } from '@a11y-oracle/core-engine';
export type { StateMapping, AXNodeProperty } from '@a11y-oracle/core-engine';

// Re-exports from sub-engines
export type { ModifierKeys, FocusedElementInfo, KeyDefinition } from '@a11y-oracle/core-engine';
export { KEY_DEFINITIONS } from '@a11y-oracle/core-engine';
export type { FocusIndicator, TabOrderEntry, TabOrderReport, TraversalResult } from '@a11y-oracle/core-engine';
```
