# @a11y-oracle/visual-engine

Visual pixel analysis engine for resolving incomplete color contrast warnings from axe-core. Provides CSS halo heuristic detection, CDP-based screenshot capture, and pixel-level luminance analysis using the WCAG Safe Assessment Matrix.

## Installation

```bash
npm install @a11y-oracle/visual-engine
```

> **Note:** Most users should use [`@a11y-oracle/axe-bridge`](../axe-bridge/README.md) instead, which wraps this engine and integrates directly with axe-core results. Install the visual-engine directly only if you need fine-grained control over individual analysis steps or are building a custom integration.

## Usage

### VisualContrastAnalyzer (Recommended)

The coordinator class runs the full pipeline for a single element:

```typescript
import { VisualContrastAnalyzer } from '@a11y-oracle/visual-engine';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';

const analyzer = new VisualContrastAnalyzer(cdpSession);

const result = await analyzer.analyzeElement('#hero-text', 4.5);

switch (result.category) {
  case 'pass':       // Worst-case contrast passes threshold
  case 'violation':  // Best-case contrast fails threshold
  case 'incomplete': // Split decision, dynamic content, or unresolvable
}
```

### Individual Pipeline Steps

Each stage of the pipeline is also exported for advanced use:

```typescript
import {
  getElementStyles,
  captureElementBackground,
  analyzeHalo,
  extractPixelLuminance,
} from '@a11y-oracle/visual-engine';

// 1. Get computed styles via CDP
const styles = await getElementStyles(cdp, '#my-element');

// 2. CSS halo fast path (no screenshot needed)
const halo = analyzeHalo(styles, 4.5);
if (halo.hasValidHalo) {
  // Element has a valid text stroke or shadow halo
}

// 3. Capture background with text hidden
const capture = await captureElementBackground(cdp, '#my-element');

// 4. Pixel-level luminance analysis
const pixels = extractPixelLuminance(capture.pngBuffer, capture.textColor);
```

## Analysis Pipeline

The `VisualContrastAnalyzer.analyzeElement()` method runs this pipeline:

1. **Get Computed Styles** — Fetches `color`, `backgroundColor`, `textStrokeWidth`, `textStrokeColor`, `textShadow`, and `backgroundImage` via CDP `Runtime.evaluate`.

2. **Dynamic Content Check** — Detects video/canvas ancestors, sub-1 opacity, and CSS blend modes. Dynamic content is left as `incomplete`.

3. **CSS Halo Heuristic** (fast path) — Checks for:
   - `-webkit-text-stroke` >= 1px with sufficient contrast against the background
   - `text-shadow` with 4+ zero-blur directional shadows covering all quadrants

   If a valid halo is found and its color passes the threshold against the background, the element passes without a screenshot.

4. **Screenshot Capture** — Scrolls the element into the viewport (ensuring off-screen elements produce valid screenshots), hides the element's text (sets `color: transparent`), captures a clipped screenshot via CDP `Page.captureScreenshot`, then restores the text.

5. **Pixel Analysis** — Decodes the PNG, scans all opaque pixels for luminance extremes (lightest and darkest), and computes contrast ratios against the text color.

6. **Safe Assessment Matrix**:
   - **Pass**: Text contrast against the *lightest* AND *darkest* background pixels both meet the threshold (worst-case passes)
   - **Violation**: Text contrast against the *lightest* AND *darkest* background pixels both fail the threshold (best-case fails)
   - **Incomplete**: One passes and one fails (split decision) — cannot safely categorize

## API Reference

### VisualContrastAnalyzer

#### `constructor(cdp: CDPSessionLike)`

Create an analyzer bound to a CDP session.

#### `analyzeElement(selector, threshold?): Promise<ContrastAnalysisResult>`

Run the full pipeline on an element.

- **selector** — CSS selector targeting the element
- **threshold** — Minimum contrast ratio (default: 4.5)
- **Returns** — `ContrastAnalysisResult` with `category`, `textColor`, `halo`, `pixels`, and `reason`

### Halo Detection

#### `analyzeHalo(styles, threshold?): HaloResult`

Check if computed styles contain a valid CSS halo.

- **styles** — `ElementComputedStyles` from `getElementStyles()`
- **threshold** — Minimum contrast ratio (default: 4.5)
- **Returns** — `HaloResult` with `hasValidHalo`, `haloContrast`, `method`, and `skipReason`

#### `parseTextShadow(css): TextShadowPart[]`

Parse a CSS `text-shadow` value into structured parts.

### Pixel Analysis

#### `extractPixelLuminance(pngBuffer, textColor): PixelAnalysisResult | null`

Decode a PNG and compute contrast ratios against a text color.

- **pngBuffer** — Raw PNG buffer from `captureElementBackground()`
- **textColor** — `RGBColor` of the foreground text
- **Returns** — Luminance extremes and contrast ratios, or `null` if no opaque pixels

#### `decodePng(buffer): { width, height, data: Uint8Array }`

Decode a PNG buffer into raw RGBA pixel data.

### Screenshot Capture

#### `getElementStyles(cdp, selector): Promise<ElementComputedStyles | null>`

Fetch computed styles for an element via CDP.

#### `captureElementBackground(cdp, selector): Promise<{ pngBuffer: Buffer; textColor: RGBColor | null } | null>`

Capture a clipped screenshot of an element with its text hidden. Automatically scrolls the element into the viewport before capture, ensuring elements below the fold produce valid screenshots instead of blank images.

## Types

```typescript
import type {
  ContrastAnalysisResult,  // Full analysis result
  ContrastCategory,        // 'pass' | 'violation' | 'incomplete'
  HaloResult,              // CSS halo analysis result
  PixelAnalysisResult,     // Luminance extremes + contrast ratios
  TextShadowPart,          // Parsed text-shadow entry
  ElementComputedStyles,   // Computed CSS properties for contrast analysis
} from '@a11y-oracle/visual-engine';
```

## Dependencies

- **`@a11y-oracle/focus-analyzer`** — Reuses `relativeLuminance()`, `contrastRatio()`, and `parseColor()` for WCAG-compliant color math
- **`@a11y-oracle/cdp-types`** — `CDPSessionLike` interface for framework-agnostic CDP access
- **`fast-png`** — Pure TypeScript PNG decoder/encoder (browser + Node.js compatible, no native dependencies)
