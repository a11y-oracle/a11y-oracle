/**
 * @module @a11y-oracle/visual-engine
 *
 * Visual pixel analysis engine for resolving incomplete color contrast
 * warnings. Provides CSS halo heuristic detection, CDP-based screenshot
 * capture, and pixel-level luminance analysis using the WCAG Safe
 * Assessment Matrix.
 *
 * @packageDocumentation
 */

export { VisualContrastAnalyzer } from './lib/visual-analyzer.js';
export { analyzeHalo, parseTextShadow } from './lib/halo-detector.js';
export { extractPixelLuminance, decodePng } from './lib/pixel-analysis.js';
export { captureElementBackground, getElementStyles } from './lib/screenshot.js';
export type {
  ContrastAnalysisResult,
  ContrastCategory,
  HaloResult,
  PixelAnalysisResult,
  TextShadowPart,
  ElementComputedStyles,
} from './lib/types.js';
