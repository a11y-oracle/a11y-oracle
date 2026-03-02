# @a11y-oracle/core-engine

Framework-agnostic speech engine for A11y-Oracle. Connects to the browser's Accessibility Tree via the Chrome DevTools Protocol and generates standardized speech output following the format:

```
[Computed Name], [Role], [State/Properties]
```

This package is the foundation that the Playwright and Cypress plugins build on. You can also use it directly with any CDP-compatible client.

## Installation

```bash
npm install @a11y-oracle/core-engine
```

## Usage

The engine operates through a `CDPSessionLike` interface, which any CDP client can satisfy:

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
```

## API Reference

### `SpeechEngine`

The central class. All methods are async and operate through the CDP session.

#### `constructor(cdp: CDPSessionLike, options?: SpeechEngineOptions)`

Create a new engine instance.

- `cdp` -- Any object implementing the `CDPSessionLike` interface.
- `options.includeLandmarks` -- Append "landmark" to landmark roles. Default `true`.
- `options.includeDescription` -- Include `aria-describedby` text. Default `false`.

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

### `CDPSessionLike`

The abstraction boundary between the engine and test frameworks. Any object with a compatible `send` method works:

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

### `SpeechResult`

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
// Main class
export { SpeechEngine } from './lib/speech-engine';

// Types
export type { CDPSessionLike, SpeechResult, SpeechEngineOptions } from './lib/types';
export type { StateMapping, AXNodeProperty } from './lib/state-map';

// Data (for advanced customization)
export { ROLE_TO_SPEECH, LANDMARK_ROLES } from './lib/role-map';
export { STATE_MAPPINGS, extractStates } from './lib/state-map';
```
