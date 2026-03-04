# @a11y-oracle/axe-bridge

Axe-core result post-processor that resolves "incomplete" (Needs Review) findings using visual analysis, keyboard interaction, and CDP inspection. Drop-in middleware between axe-core's `analyze()` and your assertion layer.

## The Problem

axe-core marks rules as "incomplete" when they require state changes, interaction, or spatial awareness that static DOM analysis cannot reliably perform. This creates noise in CI dashboards and requires manual review for rules like color contrast, focus indicators, target sizes, and more.

## The Solution

`resolveAllIncomplete()` takes axe-core results and a live CDP session, then pipes them through 10 specialized resolvers that promote findings from `incomplete` to `passes` or `violations`:

| # | Rule ID | WCAG SC | Technique |
|---|---------|---------|-----------|
| 1 | `color-contrast` | 1.4.3 | CSS halo heuristic + pixel-level screenshot analysis |
| 2 | `identical-links-same-purpose` | 2.4.4 | URL normalization and comparison |
| 3 | `link-in-text-block` | 1.4.1 | Default-state computed style checks |
| 4 | `target-size` | 2.5.8 | Bounding box measurements + spacing |
| 5 | `scrollable-region-focusable` | 2.1.1 | Scroll height + focusable child traversal |
| 6 | `skip-link` | 2.4.1 | Tab-focus visibility verification |
| 7 | `aria-hidden-focus` | 4.1.2 | Full keyboard Tab traversal |
| 8 | `focus-indicator` | 2.4.7 | Before/after screenshot pixel diff |
| 9 | `content-on-hover` | 1.4.13 | Hover + dismiss interaction tests |
| 10 | `frame-tested` | N/A | Cross-origin iframe axe-core injection |

## Installation

```bash
npm install @a11y-oracle/axe-bridge
```

## Usage

### Resolve All Incompletes (Recommended)

```typescript
import { resolveAllIncomplete } from '@a11y-oracle/axe-bridge';

// After running axe-core while the page is still live:
const axeResults = await axe.run(document);
const resolved = await resolveAllIncomplete(cdpSession, axeResults);

// resolved.incomplete will have fewer (or zero) entries
// resolved.violations and resolved.passes will have the promoted entries
```

### With Options

```typescript
const resolved = await resolveAllIncomplete(cdpSession, axeResults, {
  wcagLevel: 'wcag22aa',
  contrast: { threshold: 4.5, largeTextThreshold: 3.0 },
  focusIndicator: { focusSettleDelay: 150, diffThreshold: 0.2 },
  skipRules: ['frame-tested'], // skip specific resolvers
});
```

### Individual Resolvers

Each resolver can be used standalone:

```typescript
import { resolveIncompleteContrast } from '@a11y-oracle/axe-bridge';

const resolved = await resolveIncompleteContrast(cdpSession, axeResults, {
  wcagLevel: 'wcag22aa',
});
```

### With Playwright

```typescript
import { test, expect } from '@playwright/test';
import { resolveAllIncomplete } from '@a11y-oracle/axe-bridge';

test('no unresolved accessibility issues', async ({ page }) => {
  await page.goto('/my-page.html');
  const cdp = await page.context().newCDPSession(page);

  const axeResults = await axe.run(document);
  const resolved = await resolveAllIncomplete(cdp, axeResults);

  expect(resolved.violations).toHaveLength(0);
  expect(resolved.incomplete).toHaveLength(0);

  await cdp.detach();
});
```

### With Cypress

```typescript
// Using Cypress.automation for CDP access:
cy.window().then(async (win) => {
  const axeResults = await axeCore.run(win.document);

  // cdpSession obtained via Cypress.automation('remote:debugger:protocol', ...)
  const resolved = await resolveAllIncomplete(cdpSession, axeResults);

  expect(resolved.violations).to.have.length(0);
});
```

## API Reference

### `resolveAllIncomplete(cdp, axeResults, options?)`

Orchestrator that pipes results through all 10 resolvers in sequence. Each resolver receives the output of the previous one.

- **Parameters:**
  - `cdp: CDPSessionLike` — CDP session connected to the page
  - `axeResults: AxeResults` — Raw results from axe-core's `analyze()`
  - `options?: IncompleteResolutionOptions` — Per-resolver options and `skipRules` filter
- **Returns:** `Promise<AxeResults>` — Modified copy with resolved findings
- **Pipeline order:** color-contrast → identical-links-same-purpose → link-in-text-block → target-size → scrollable-region-focusable → skip-link → aria-hidden-focus → focus-indicator → content-on-hover → frame-tested

### Individual Resolvers

#### `resolveIncompleteContrast(cdp, axeResults, options?)`

Resolves `color-contrast` incomplete entries using CSS halo heuristics and pixel-level screenshot analysis.

- **Options:** `ContrastResolutionOptions` — `wcagLevel`, `threshold`, `largeTextThreshold`
- Automatically detects large text from axe-core's check data (>= 24px or bold >= 18.66px)

#### `resolveIdenticalLinksSamePurpose(cdp, axeResults)`

Resolves `identical-links-same-purpose` by normalizing URLs (stripping query params, hashes, resolving relative paths) and comparing destinations.

- Same destination → **Pass**, different → **Violation**

#### `resolveLinkInTextBlock(cdp, axeResults, options?)`

Resolves `link-in-text-block` by checking the **default/resting state** for non-color visual indicators.

- **Options:** `LinkInTextBlockOptions` — `linkTextContrastThreshold` (default: 3.0)
- Checks: `text-decoration: underline`, `border-bottom > 0`, `font-weight` difference from parent
- If no non-color indicator: compares link vs surrounding text color contrast

#### `resolveTargetSize(cdp, axeResults, options?)`

Resolves `target-size` by measuring bounding boxes and center-to-center spacing.

- **Options:** `TargetSizeOptions` — `minSize` (default: 24)
- Width/height >= 24px → **Pass**; undersized with 24px+ spacing → **Pass**; otherwise → **Violation**

#### `resolveScrollableRegionFocusable(cdp, axeResults, options?)`

Resolves `scrollable-region-focusable` by checking scroll height, tabindex, and focusable children.

- **Options:** `ScrollableRegionOptions` — `maxChildren` (default: 50)
- Not actually scrollable → **Pass**; has `tabindex >= 0` → **Pass**; focusable children scroll to content → **Pass**

#### `resolveSkipLink(cdp, axeResults, options?)`

Resolves `skip-link` by focusing the skip link and verifying it becomes visible.

- **Options:** `SkipLinkOptions` — `focusSettleDelay` (default: 100)
- Checks bounding box, viewport containment, opacity, clip, position

#### `resolveAriaHiddenFocus(cdp, axeResults, options?)`

Resolves `aria-hidden-focus` via a single keyboard Tab traversal across all flagged nodes.

- **Options:** `AriaHiddenFocusOptions` — `maxTabs` (default: 100)
- Tab lands on flagged element → **Violation**; traversal completes without landing → **Pass**

#### `resolveFocusIndicator(cdp, axeResults, options?)`

Resolves `focus-indicator` by pixel-diffing before/after focus screenshots.

- **Options:** `FocusIndicatorOptions` — `focusSettleDelay` (default: 100), `diffThreshold` (default: 0.1%)
- Screenshots are identical → **Violation**; pixels changed → **Pass**

#### `resolveContentOnHover(cdp, axeResults, options?)`

Resolves `content-on-hover` with hover and dismiss interaction tests.

- **Options:** `ContentOnHoverOptions` — `hoverDelay` (default: 300), `dismissDelay` (default: 200)
- Tests: content appears on hover, remains when mouse moves to content (hoverable), disappears on Escape (dismissible)

#### `resolveFrameTested(cdp, axeResults, options?)`

Resolves `frame-tested` by injecting axe-core into cross-origin iframes via CDP.

- **Options:** `FrameTestedOptions` — `axeSource` (complete axe-core script), `iframeTimeout` (default: 30000)
- Uses `Page.createIsolatedWorld` to bypass same-origin restrictions

### Pipeline Utilities

Shared helpers used by all resolvers:

```typescript
import {
  getSelector,        // Extract innermost CSS selector from axe node target
  cloneResults,       // Deep-clone AxeResults without mutation
  ruleShell,          // Create a rule shell (metadata only, no nodes)
  findIncompleteRule,  // Find a rule by ID in the incomplete array
  applyPromotions,    // Move nodes between incomplete/passes/violations
} from '@a11y-oracle/axe-bridge';
```

### Types

```typescript
import type {
  // Axe-core compatible types
  AxeResults,
  AxeRule,
  AxeNode,
  AxeCheck,

  // WCAG level
  WcagLevel,
  ContrastThresholds,

  // Per-resolver options
  ContrastResolutionOptions,
  LinkInTextBlockOptions,
  TargetSizeOptions,
  ScrollableRegionOptions,
  SkipLinkOptions,
  AriaHiddenFocusOptions,
  FocusIndicatorOptions,
  ContentOnHoverOptions,
  FrameTestedOptions,

  // Orchestrator options
  IncompleteResolutionOptions,

  // Pipeline utility types
  PromotionResult,
} from '@a11y-oracle/axe-bridge';
```

> **Note:** Axe-core types are locally defined for structural compatibility without requiring axe-core as a runtime dependency.

## How It Works

Each resolver follows a common pipeline pattern:

1. **Clone** — Deep-clone the input results (original is never mutated)
2. **Find** — Locate the target rule in the `incomplete` array
3. **Analyze** — For each flagged node, run the resolver's specific technique (CDP queries, screenshots, keyboard traversal, etc.)
4. **Promote** — Move resolved nodes to `passes` or `violations`; unresolved nodes stay in `incomplete`

The `resolveAllIncomplete` orchestrator chains all resolvers in sequence, so findings accumulate through the pipeline.

## Dependencies

- **`@a11y-oracle/visual-engine`** — Visual analysis engine (halo detection, pixel analysis, PNG decoding, CDP capture)
- **`@a11y-oracle/focus-analyzer`** — Color parsing and contrast ratio computation
- **`@a11y-oracle/keyboard-engine`** — Native CDP keyboard dispatch for skip-link, aria-hidden-focus, and content-on-hover
- **`@a11y-oracle/cdp-types`** — `CDPSessionLike` interface for framework-agnostic CDP access
