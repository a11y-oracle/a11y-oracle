# @a11y-oracle/keyboard-engine

CDP-based keyboard dispatch engine for accessibility testing. Sends native hardware-level keystrokes via `Input.dispatchKeyEvent` and reads focused element information via `Runtime.evaluate`.

This is a low-level building block used internally by `@a11y-oracle/core-engine`. Most users should use the Playwright or Cypress plugin instead.

## Installation

```bash
npm install @a11y-oracle/keyboard-engine
```

## Usage

```typescript
import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';

const keyboard = new KeyboardEngine(cdpSession);

// Press a key
await keyboard.press('Tab');

// Press with modifiers
await keyboard.press('Tab', { shift: true });   // Shift+Tab (backward)
await keyboard.press('a', { ctrl: true });       // Ctrl+A (select all)

// Get info about the currently focused element
const el = await keyboard.getFocusedElement();
if (el) {
  console.log(el.tag);      // "BUTTON"
  console.log(el.id);       // "submit-btn"
  console.log(el.role);     // "button"
  console.log(el.tabIndex); // 0
  console.log(el.rect);     // { x: 100, y: 200, width: 120, height: 40 }
}
```

## API Reference

### `KeyboardEngine`

#### `constructor(cdp: CDPSessionLike)`

Create a new keyboard engine.

- `cdp` — Any object with a `send(method, params?)` method compatible with CDP.

#### `press(key: string, modifiers?: ModifierKeys): Promise<void>`

Dispatch a native key press via CDP `Input.dispatchKeyEvent`. Sends a `keyDown` event followed by a `keyUp` event, matching the behavior of a physical key press.

- `key` — Key name from `KEY_DEFINITIONS` (see table below).
- `modifiers` — Optional modifier keys to hold during the press.

Modifier keys map to the CDP bitmask: Alt = 1, Ctrl = 2, Meta = 4, Shift = 8.

Throws if the key name is not in `KEY_DEFINITIONS`.

#### `getFocusedElement(): Promise<FocusedElementInfo | null>`

Get information about the currently focused DOM element via `Runtime.evaluate`.

Returns `null` if no interactive element has focus (e.g., `document.body` or `document.documentElement` is focused).

### Supported Keys

| Key Name | Description |
|----------|-------------|
| `Tab` | Tab navigation |
| `Enter` | Activate / submit |
| `Space` or `' '` | Activate / toggle |
| `Escape` | Cancel / close |
| `ArrowUp` | Navigate up |
| `ArrowDown` | Navigate down |
| `ArrowLeft` | Navigate left |
| `ArrowRight` | Navigate right |
| `Home` | Jump to start |
| `End` | Jump to end |
| `Backspace` | Delete backward |
| `Delete` | Delete forward |

### Types

#### `KeyDefinition`

CDP keyboard event parameters for a single key:

```typescript
interface KeyDefinition {
  key: string;     // CDP key property (e.g. "Tab")
  code: string;    // CDP code property (e.g. "Tab")
  keyCode: number; // Windows virtual key code (e.g. 9)
}
```

#### `ModifierKeys`

Modifier keys for key press combinations:

```typescript
interface ModifierKeys {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}
```

#### `FocusedElementInfo`

Information about the currently focused DOM element:

```typescript
interface FocusedElementInfo {
  tag: string;        // "BUTTON"
  id: string;         // "submit-btn"
  className: string;  // "btn primary"
  textContent: string; // "Submit"
  role: string;       // "button" (from role attribute)
  ariaLabel: string;  // "Submit form" (from aria-label)
  tabIndex: number;   // 0
  rect: { x: number; y: number; width: number; height: number };
}
```

## Exports

```typescript
export { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
export { KEY_DEFINITIONS } from '@a11y-oracle/keyboard-engine';
export type {
  KeyDefinition,
  ModifierKeys,
  FocusedElementInfo,
} from '@a11y-oracle/keyboard-engine';
```

## How It Works

The engine uses two CDP domains:

1. **`Input.dispatchKeyEvent`** — Sends real hardware-level keystroke events (keyDown + keyUp) directly to the browser. This bypasses synthetic JavaScript event dispatch (`element.dispatchEvent()`), so the browser handles focus management natively — just as if a user physically pressed the key.

2. **`Runtime.evaluate`** — Executes a JavaScript expression in the page context to read `document.activeElement` properties (tag, id, class, role, aria-label, tabIndex, bounding rect).
