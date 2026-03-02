/**
 * @module types
 *
 * Type definitions for focus analysis, tab order traversal,
 * and keyboard trap detection.
 */

/**
 * An RGBA color tuple with channels in the range [0, 255]
 * and alpha in the range [0, 1].
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Analysis of the visual focus indicator on the currently focused element.
 *
 * Includes raw CSS values, parsed contrast ratio, and WCAG 2.4.12 AA pass/fail.
 */
export interface FocusIndicator {
  /** Whether any visual focus indicator is detected. */
  isVisible: boolean;
  /** Raw `outline` shorthand value. */
  outline: string;
  /** Computed `outline-color`. */
  outlineColor: string;
  /** Computed `outline-width`. */
  outlineWidth: string;
  /** Computed `outline-offset`. */
  outlineOffset: string;
  /** Computed `box-shadow`. */
  boxShadow: string;
  /** Computed `border-color`. */
  borderColor: string;
  /** Computed `background-color`. */
  backgroundColor: string;
  /**
   * Contrast ratio of the focus indicator against the background.
   * `null` if the colors could not be reliably parsed.
   */
  contrastRatio: number | null;
  /**
   * Whether the focus indicator meets WCAG 2.4.12 AA
   * (contrast ratio >= 3.0 and indicator is visible).
   */
  meetsWCAG_AA: boolean;
}

/**
 * A single entry in the tab order — an element that can receive
 * focus via the Tab key.
 */
export interface TabOrderEntry {
  /** Position in the actual tab order (0-based). */
  index: number;
  /** Tag name (e.g. `'BUTTON'`). */
  tag: string;
  /** Element `id` attribute, or empty string. */
  id: string;
  /** Trimmed text content of the element. */
  textContent: string;
  /** The element's `tabIndex` property. */
  tabIndex: number;
  /** The element's `role` attribute, or empty string. */
  role: string;
  /** Bounding rectangle. */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Result of a keyboard trap detection traversal.
 */
export interface TraversalResult {
  /** Whether focus was trapped (could not escape the container). */
  isTrapped: boolean;
  /** Total number of Tab presses attempted. */
  tabCount: number;
  /** Elements that received focus during the traversal. */
  visitedElements: TabOrderEntry[];
  /** The first element outside the container that received focus, or `null` if trapped. */
  escapeElement: TabOrderEntry | null;
}

/**
 * Full report of a tab order traversal across the page.
 */
export interface TabOrderReport {
  /** Tabbable elements in actual tab-key order. */
  entries: TabOrderEntry[];
  /** Total number of tabbable elements found. */
  totalCount: number;
}
