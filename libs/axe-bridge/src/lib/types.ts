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

/** Options for the incomplete contrast resolution pipeline. */
export interface ContrastResolutionOptions {
  /** Minimum contrast ratio for normal text. Default: 4.5 (WCAG AA). */
  threshold?: number;
  /** Minimum contrast ratio for large text. Default: 3.0 (WCAG AA). */
  largeTextThreshold?: number;
}
