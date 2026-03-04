# @a11y-oracle/axe-bridge

Axe-core result post-processor that resolves "incomplete" color contrast warnings using visual pixel analysis and CSS halo heuristics. Drop-in middleware between axe-core's `analyze()` and your assertion layer.

## The Problem

axe-core cannot determine actual background colors for elements with gradients, background images, or complex CSS. It flags these as "incomplete" rather than pass or violation — creating noise in CI dashboards and requiring manual review.

## The Solution

`resolveIncompleteContrast()` takes axe-core results and a live CDP session, then:

1. Identifies `color-contrast` entries in the `incomplete` array
2. For each element, runs visual analysis (CSS halo heuristic + pixel-level screenshot analysis)
3. Promotes resolved elements to `passes` or `violations`
4. Returns a modified copy of the results (original is not mutated)

## Installation

```bash
npm install @a11y-oracle/axe-bridge
```

## Usage

### Basic Usage

```typescript
import { resolveIncompleteContrast } from '@a11y-oracle/axe-bridge';

// After running axe-core while the page is still live:
const axeResults = await axe.run(document);
const resolved = await resolveIncompleteContrast(cdpSession, axeResults);

// resolved.incomplete will have fewer (or zero) color-contrast entries
// resolved.violations and resolved.passes will have the promoted entries
```

### With Cypress

```typescript
// In your Cypress support commands or plugin:
cy.window().then(async (win) => {
  const axeResults = await axeCore.run(win.document);

  // cdpSession obtained via Cypress.automation('remote:debugger:protocol', ...)
  const resolved = await resolveIncompleteContrast(cdpSession, axeResults);

  // Assert on resolved results instead of raw axe output
  expect(resolved.violations).to.have.length(0);
});
```

### With Custom Thresholds

```typescript
const resolved = await resolveIncompleteContrast(cdpSession, axeResults, {
  threshold: 4.5,            // Normal text (default)
  largeTextThreshold: 3.0,   // Large text (default)
});
```

### Large Text Detection

The bridge automatically detects large text from axe-core's check data:
- Text >= 24px (18pt) uses the 3.0 threshold
- Bold text >= 18.66px (14pt) uses the 3.0 threshold
- All other text uses the 4.5 threshold

## API Reference

### `resolveIncompleteContrast(cdp, axeResults, options?)`

Resolve incomplete color-contrast warnings from axe-core results.

- **Parameters:**
  - `cdp: CDPSessionLike` — CDP session connected to the page being tested
  - `axeResults: AxeResults` — Raw results from axe-core's `analyze()`
  - `options?: ContrastResolutionOptions` — Optional threshold overrides
- **Returns:** `Promise<AxeResults>` — Modified copy with resolved contrast findings
- **Behavior:**
  - Deep-clones the input (never mutates the original)
  - If no `color-contrast` entry exists in `incomplete`, returns unchanged
  - Promotes passing elements to `passes`, failing to `violations`
  - Appends to existing `color-contrast` entries if already present
  - Ambiguous elements (split decision, dynamic content) remain in `incomplete`

### Types

```typescript
import type {
  AxeResults,                  // { violations, passes, incomplete, inapplicable }
  AxeRule,                     // { id, impact?, tags, description, help, helpUrl, nodes }
  AxeNode,                     // { target, html, any, all, none, impact?, failureSummary? }
  AxeCheck,                    // { id, data, relatedNodes, impact?, message }
  ContrastResolutionOptions,   // { threshold?, largeTextThreshold? }
} from '@a11y-oracle/axe-bridge';
```

> **Note:** These types are locally defined for compatibility with axe-core output, without requiring axe-core as a runtime dependency.

## How It Works

For each incomplete `color-contrast` node, the bridge:

1. Extracts the CSS selector from the axe node's `target` array
2. Determines the effective threshold (3.0 for large text, 4.5 otherwise)
3. Delegates to `VisualContrastAnalyzer` from `@a11y-oracle/visual-engine`, which runs:
   - **CSS Halo Check** — Detects `-webkit-text-stroke` or multi-directional `text-shadow` that guarantees readability
   - **Screenshot + Pixel Analysis** — Captures the background with text hidden, scans for luminance extremes, applies the Safe Assessment Matrix

## Dependencies

- **`@a11y-oracle/visual-engine`** — Visual analysis engine (halo detection, pixel analysis, CDP capture)
- **`@a11y-oracle/cdp-types`** — `CDPSessionLike` interface
