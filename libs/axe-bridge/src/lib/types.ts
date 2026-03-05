/**
 * @module types
 *
 * Minimal axe-core compatible types for the bridge. Defined locally
 * to avoid a runtime dependency on axe-core. Structurally compatible
 * with axe-core's result shapes.
 */

/** A single check result within an axe node. */
export interface AxeCheck {
  /** Check identifier. */
  id: string;
  /** Check-specific data (e.g., fontSize, fontWeight for color-contrast). */
  data: unknown;
  /** Related DOM nodes. */
  relatedNodes: unknown[];
  /** Impact level. */
  impact?: string;
  /** Description of the check result. */
  message: string;
}

/** A single DOM node result from an axe rule. */
export interface AxeNode {
  /** CSS selector path to the element. */
  target: string[];
  /** HTML snippet of the element. */
  html: string;
  /** Checks where any one passing fixes the issue. */
  any: AxeCheck[];
  /** Checks where all must pass. */
  all: AxeCheck[];
  /** Checks where none should be present. */
  none: AxeCheck[];
  /** Node-level impact. */
  impact?: string | null;
  /** Human-readable failure summary. */
  failureSummary?: string;
}

/** A single axe rule result (violation, pass, or incomplete). */
export interface AxeRule {
  /** Rule identifier (e.g., 'color-contrast'). */
  id: string;
  /** Impact severity. */
  impact?: string | null;
  /** WCAG tags. */
  tags: string[];
  /** Rule description. */
  description: string;
  /** Short help text. */
  help: string;
  /** URL to help documentation. */
  helpUrl: string;
  /** Affected DOM nodes. */
  nodes: AxeNode[];
}

/**
 * Full axe-core results object. Structurally compatible with
 * `axe.AxeResults` without requiring the axe-core dependency.
 */
export interface AxeResults {
  /** Rules that found violations. */
  violations: AxeRule[];
  /** Rules that passed. */
  passes: AxeRule[];
  /** Rules that could not be fully evaluated. */
  incomplete: AxeRule[];
  /** Rules that were not applicable. */
  inapplicable: AxeRule[];
  /** Allow additional properties from axe-core. */
  [key: string]: unknown;
}

/**
 * WCAG conformance level.
 *
 * Structurally compatible with the `WcagLevel` type in
 * `@a11y-oracle/audit-formatter`. Defined locally to avoid an
 * unnecessary cross-library dependency.
 *
 * Each AA level includes the contrast requirement (SC 1.4.3).
 * Level A has no contrast SC.
 */
export type WcagLevel =
  | 'wcag2a'    // WCAG 2.0 Level A
  | 'wcag2aa'   // WCAG 2.0 Level AA
  | 'wcag21a'   // WCAG 2.1 Level A
  | 'wcag21aa'  // WCAG 2.1 Level AA
  | 'wcag22a'   // WCAG 2.2 Level A
  | 'wcag22aa'; // WCAG 2.2 Level AA (default)

/**
 * Contrast ratio thresholds for a WCAG conformance level.
 */
export interface ContrastThresholds {
  /** Minimum contrast ratio for normal text (e.g. 4.5 for AA). */
  normalText: number;
  /** Minimum contrast ratio for large text (e.g. 3.0 for AA). */
  largeText: number;
}

/**
 * Options for the incomplete contrast resolution pipeline.
 *
 * When `wcagLevel` is provided, thresholds are derived automatically.
 * Explicit `threshold` / `largeTextThreshold` values override the
 * level-derived values.
 */
export interface ContrastResolutionOptions {
  /**
   * WCAG conformance level. When set, contrast thresholds are derived
   * from the level (e.g. AA → 4.5 / 3.0). Explicit threshold values
   * take precedence. Default: `'wcag22aa'`.
   */
  wcagLevel?: WcagLevel;
  /** Minimum contrast ratio for normal text. Overrides wcagLevel. */
  threshold?: number;
  /** Minimum contrast ratio for large text. Overrides wcagLevel. */
  largeTextThreshold?: number;
  /**
   * If at least this fraction of pixels pass during a split decision,
   * auto-pass the element (supermajority rule).
   * Default: `0.75`.
   */
  supermajorityPassRatio?: number;
  /**
   * If the best-case extreme CR exceeds the WCAG threshold multiplied
   * by this value, auto-pass regardless of pixel distribution.
   * Default: `2.0`.
   */
  bestCaseMultiplier?: number;
}

// ─── Per-resolver option interfaces ─────────────────────────────

/** Options for the `link-in-text-block` resolver. */
export interface LinkInTextBlockOptions {
  /**
   * Minimum contrast ratio between link color and surrounding text
   * to count as sufficient visual differentiation.
   * Default: `3.0`.
   */
  linkTextContrastThreshold?: number;
}

/** Options for the `target-size` resolver. */
export interface TargetSizeOptions {
  /**
   * Minimum dimension (width and height) in CSS pixels.
   * Default: `24`.
   */
  minSize?: number;
}

/** Options for the `scrollable-region-focusable` resolver. */
export interface ScrollableRegionOptions {
  /**
   * Maximum number of focusable children to inspect inside a
   * scrollable container before giving up.
   * Default: `50`.
   */
  maxChildren?: number;
}

/** Options for the `skip-link` resolver. */
export interface SkipLinkOptions {
  /**
   * Delay in milliseconds after focus for CSS transitions to settle.
   * Default: `100`.
   */
  focusSettleDelay?: number;
}

/** Options for the `aria-hidden-focus` resolver. */
export interface AriaHiddenFocusOptions {
  /**
   * Maximum number of Tab presses during keyboard traversal.
   * Default: `100`.
   */
  maxTabs?: number;
}

/** Options for the `focus-indicator` resolver. */
export interface FocusIndicatorOptions {
  /**
   * Delay in milliseconds after focus for CSS transitions to settle.
   * Default: `100`.
   */
  focusSettleDelay?: number;
  /**
   * Minimum percentage of pixels that must differ between resting
   * and focused screenshots to count as a visible indicator.
   * Default: `0.1`.
   */
  diffThreshold?: number;
}

/** Options for the `content-on-hover` resolver. */
export interface ContentOnHoverOptions {
  /**
   * Delay in milliseconds after hover for content to appear.
   * Default: `300`.
   */
  hoverDelay?: number;
  /**
   * Delay in milliseconds after dismiss action to check if content
   * has disappeared.
   * Default: `200`.
   */
  dismissDelay?: number;
}

/** Options for the `frame-tested` resolver. */
export interface FrameTestedOptions {
  /**
   * The complete axe-core source code as a string. Required for
   * injection into cross-origin iframes.
   */
  axeSource?: string;
  /**
   * Timeout in milliseconds for axe-core execution inside an iframe.
   * Default: `30000`.
   */
  iframeTimeout?: number;
}

/**
 * Combined options for the `resolveAllIncomplete` orchestrator.
 *
 * Each property corresponds to a resolver's options interface.
 * The `skipRules` array allows excluding specific resolvers.
 */
export interface IncompleteResolutionOptions {
  /** WCAG conformance level (applied to contrast resolver). */
  wcagLevel?: WcagLevel;

  /** Options for the `color-contrast` resolver. */
  contrast?: ContrastResolutionOptions;

  /** Options for the `link-in-text-block` resolver. */
  linkInTextBlock?: LinkInTextBlockOptions;

  /** Options for the `target-size` resolver. */
  targetSize?: TargetSizeOptions;

  /** Options for the `scrollable-region-focusable` resolver. */
  scrollableRegion?: ScrollableRegionOptions;

  /** Options for the `skip-link` resolver. */
  skipLink?: SkipLinkOptions;

  /** Options for the `aria-hidden-focus` resolver. */
  ariaHiddenFocus?: AriaHiddenFocusOptions;

  /** Options for the `focus-indicator` resolver. */
  focusIndicator?: FocusIndicatorOptions;

  /** Options for the `content-on-hover` resolver. */
  contentOnHover?: ContentOnHoverOptions;

  /** Options for the `frame-tested` resolver. */
  frameTested?: FrameTestedOptions;

  /**
   * Rule IDs to skip during resolution. Matching resolvers
   * will not be invoked and their incomplete entries will be
   * left untouched.
   */
  skipRules?: string[];
}
