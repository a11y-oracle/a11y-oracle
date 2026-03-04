# @a11y-oracle/focus-analyzer

Focus state analysis for accessibility testing. Provides visual focus indicator inspection, WCAG contrast ratio calculation, DOM tab order extraction, and keyboard trap detection.

This is a low-level building block used internally by `@a11y-oracle/core-engine`. Most users should use the Playwright or Cypress plugin instead.

## Installation

```bash
npm install @a11y-oracle/focus-analyzer
```

## Usage

```typescript
import { FocusAnalyzer } from '@a11y-oracle/focus-analyzer';

const analyzer = new FocusAnalyzer(cdpSession);

// Analyze the focus indicator on the currently focused element
const indicator = await analyzer.getFocusIndicator();
console.log(indicator.isVisible);     // true
console.log(indicator.contrastRatio); // 12.63
console.log(indicator.meetsWCAG_AA);  // true (visible + contrast >= 3.0)
console.log(indicator.outlineColor);  // "rgb(0, 95, 204)"
console.log(indicator.outlineWidth);  // "3px"

// Extract all tabbable elements in DOM tab order
const entries = await analyzer.getTabOrder();
entries.forEach(e => {
  console.log(`${e.index}: ${e.tag}#${e.id} (tabIndex=${e.tabIndex})`);
});

// Detect keyboard traps (WCAG 2.1.2)
const result = await analyzer.detectKeyboardTrap('#modal-container', 20);
if (result.isTrapped) {
  console.log('Focus is trapped!');
} else {
  console.log(`Focus escaped to: ${result.escapeElement?.tag}`);
}
```

## API Reference

### `FocusAnalyzer`

#### `constructor(cdp: CDPSessionLike)`

Create a new focus analyzer. Internally creates a `KeyboardEngine` for trap detection.

- `cdp` — Any CDP-compatible session (uses the `CDPSessionLike` interface from `@a11y-oracle/cdp-types`).

#### `getFocusIndicator(): Promise<FocusIndicator>`

Analyze the visual focus indicator of the currently focused element.

Extracts computed CSS properties (`outline`, `box-shadow`, `border-color`, `background-color`) via `Runtime.evaluate`, then calculates the contrast ratio of the focus indicator against the background.

Returns a default "not visible" indicator if no element has focus.

**Visibility detection:**
- An element has a visible **outline** if `outline-width` is not `0px` and `outline-color` is not `transparent`
- An element has a visible **box-shadow** if `box-shadow` is not `none`

**Contrast calculation:**
- For outlines: contrast ratio between `outline-color` and `background-color`
- For box-shadows: extracts the first color from the `box-shadow` value and computes contrast against `background-color`
- Returns `contrastRatio: null` if colors cannot be reliably parsed (e.g., gradients, complex color functions)

**WCAG 2.4.12 AA compliance:** `meetsWCAG_AA` is `true` when the indicator is visible AND the contrast ratio >= 3.0.

#### `getTabOrder(): Promise<TabOrderEntry[]>`

Extract all tabbable elements from the DOM in tab order.

Queries for focusable elements (`a[href]`, `button:not([disabled])`, `input:not([disabled])`, `select:not([disabled])`, `textarea:not([disabled])`, `[tabindex]`), then filters out:
- Elements with `tabIndex < 0`
- Hidden elements (`display: none`, `visibility: hidden`)
- Elements with no layout (`offsetParent === null`)
- Elements inside `[inert]` containers

Results are sorted by `tabIndex` value: positive `tabIndex` values first (ascending), then `tabIndex=0` elements in DOM order.

#### `detectKeyboardTrap(selector: string, maxTabs?: number): Promise<TraversalResult>`

Detect whether focus is trapped inside a container (WCAG 2.1.2).

1. Focuses the first tabbable element inside the container matching `selector`
2. Presses Tab repeatedly (up to `maxTabs`, default 50)
3. After each Tab, checks whether focus has left the container
4. Returns immediately if focus escapes, or declares a trap if `maxTabs` is exhausted

Returns `{ isTrapped: false, tabCount: 0 }` if the container doesn't exist or has no focusable elements.

### Pure Utility Functions

The package also exports pure functions for color parsing and WCAG contrast calculation:

#### `parseColor(css: string): RGBColor | null`

Parse a CSS color string to an `RGBColor` object. Supports:
- `rgb(r, g, b)` and `rgba(r, g, b, a)`
- Hex colors: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
- `transparent` (returns `{ r: 0, g: 0, b: 0, a: 0 }`)

Returns `null` for unsupported formats (named colors, `hsl()`, `color()`, etc.).

#### `srgbToLinear(channel: number): number`

Convert an sRGB channel value (0-255) to linear light.

#### `relativeLuminance(color: RGBColor): number`

Calculate WCAG relative luminance: `L = 0.2126*R + 0.7152*G + 0.0722*B`

#### `contrastRatio(color1: RGBColor, color2: RGBColor): number`

Calculate the WCAG contrast ratio between two colors. Returns a value between 1 (identical) and 21 (black on white).

#### `meetsAA(ratio: number): boolean`

Check if a contrast ratio meets WCAG AA for focus indicators (>= 3.0).

### Types

#### `RGBColor`

```typescript
interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}
```

#### `FocusIndicator`

Full focus indicator analysis:

```typescript
interface FocusIndicator {
  isVisible: boolean;
  outline: string;          // Raw outline shorthand
  outlineColor: string;     // e.g. "rgb(0, 95, 204)"
  outlineWidth: string;     // e.g. "3px"
  outlineOffset: string;    // e.g. "0px"
  boxShadow: string;        // e.g. "0px 0px 0px 3px rgb(52, 152, 219)"
  borderColor: string;
  backgroundColor: string;
  contrastRatio: number | null;
  meetsWCAG_AA: boolean;
}
```

#### `TabOrderEntry`

```typescript
interface TabOrderEntry {
  index: number;     // Position in tab order (0-based)
  tag: string;       // "BUTTON"
  id: string;
  textContent: string;
  tabIndex: number;
  role: string;
  rect: { x: number; y: number; width: number; height: number };
}
```

#### `TabOrderReport`

```typescript
interface TabOrderReport {
  entries: TabOrderEntry[];
  totalCount: number;
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

## Exports

```typescript
export { FocusAnalyzer } from '@a11y-oracle/focus-analyzer';
export { parseColor } from '@a11y-oracle/focus-analyzer';
export { srgbToLinear, relativeLuminance, contrastRatio, meetsAA } from '@a11y-oracle/focus-analyzer';
export type { RGBColor, FocusIndicator, TabOrderEntry, TraversalResult, TabOrderReport } from '@a11y-oracle/focus-analyzer';
```

## Limitations

- **Complex focus indicators** — Gradients, CSS `color-mix()`, and other advanced color functions return `contrastRatio: null` because they cannot be reliably parsed into a single color value.
- **Box-shadow parsing** — Only the first color found in a `box-shadow` value is used for contrast calculation. Multi-layer box-shadows may not be fully analyzed.
- **Keyboard trap detection** — Tests with Tab key only. Intentional focus traps (e.g., modal dialogs) should be tested separately with Escape key navigation.
- **`tabIndex` ordering** — The tab order extraction follows the standard algorithm (positive `tabIndex` first, then `tabIndex=0` in DOM order), but doesn't account for Shadow DOM boundaries.
