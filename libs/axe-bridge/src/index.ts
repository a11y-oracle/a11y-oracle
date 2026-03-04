/**
 * @module @a11y-oracle/axe-bridge
 *
 * Axe-core result post-processor that resolves "incomplete" rule
 * findings using visual analysis, keyboard interaction, and CDP
 * inspection. Drop-in middleware between axe-core's `analyze()`
 * and your assertion layer.
 *
 * @packageDocumentation
 */

// ─── Orchestrator ───────────────────────────────────────────────
export { resolveAllIncomplete } from './lib/resolve-all.js';

// ─── Individual resolvers ───────────────────────────────────────
export { resolveIncompleteContrast } from './lib/axe-bridge.js';
export { resolveIdenticalLinksSamePurpose, normalizeUrl } from './lib/resolvers/identical-links-same-purpose.js';
export { resolveLinkInTextBlock } from './lib/resolvers/link-in-text-block.js';
export { resolveTargetSize } from './lib/resolvers/target-size.js';
export { resolveScrollableRegionFocusable } from './lib/resolvers/scrollable-region-focusable.js';
export { resolveSkipLink } from './lib/resolvers/skip-link.js';
export { resolveAriaHiddenFocus } from './lib/resolvers/aria-hidden-focus.js';
export { resolveFocusIndicator } from './lib/resolvers/focus-indicator.js';
export { resolveContentOnHover } from './lib/resolvers/content-on-hover.js';
export { resolveFrameTested } from './lib/resolvers/frame-tested.js';

// ─── Threshold helpers ──────────────────────────────────────────
export { getContrastThresholds } from './lib/wcag-thresholds.js';

// ─── Pipeline utilities ─────────────────────────────────────────
export {
  getSelector,
  cloneResults,
  ruleShell,
  findIncompleteRule,
  applyPromotions,
} from './lib/resolver-pipeline.js';
export type { PromotionResult } from './lib/resolver-pipeline.js';

// ─── Types ──────────────────────────────────────────────────────
export type {
  ContrastResolutionOptions,
  ContrastThresholds,
  WcagLevel,
  AxeResults,
  AxeRule,
  AxeNode,
  AxeCheck,
  LinkInTextBlockOptions,
  TargetSizeOptions,
  ScrollableRegionOptions,
  SkipLinkOptions,
  AriaHiddenFocusOptions,
  FocusIndicatorOptions,
  ContentOnHoverOptions,
  FrameTestedOptions,
  IncompleteResolutionOptions,
} from './lib/types.js';
