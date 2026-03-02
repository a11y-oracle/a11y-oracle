/**
 * @module @a11y-oracle/focus-analyzer
 *
 * Focus state analysis for accessibility testing. Provides visual
 * focus indicator inspection, WCAG contrast ratio calculation,
 * DOM tab order extraction, and keyboard trap detection.
 *
 * @packageDocumentation
 */

export { FocusAnalyzer } from './lib/focus-analyzer.js';
export { parseColor } from './lib/color-parser.js';
export { srgbToLinear, relativeLuminance, contrastRatio, meetsAA } from './lib/contrast.js';
export type {
  RGBColor,
  FocusIndicator,
  TabOrderEntry,
  TraversalResult,
  TabOrderReport,
} from './lib/types.js';
