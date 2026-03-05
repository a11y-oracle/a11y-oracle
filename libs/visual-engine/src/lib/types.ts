/**
 * @module types
 *
 * Type definitions for visual contrast analysis, including halo
 * detection, pixel luminance analysis, and the Safe Assessment Matrix.
 */

import type { RGBColor } from '@a11y-oracle/focus-analyzer';

/** Classification of a contrast analysis result per the Safe Assessment Matrix. */
export type ContrastCategory = 'pass' | 'violation' | 'incomplete';

/** Parsed representation of a single CSS `text-shadow` declaration. */
export interface TextShadowPart {
  /** Horizontal offset in pixels. */
  offsetX: number;
  /** Vertical offset in pixels. */
  offsetY: number;
  /** Blur radius in pixels. 0 = sharp edge (valid for halo). */
  blur: number;
  /** Parsed shadow color. */
  color: RGBColor;
}

/** Result of CSS halo heuristic analysis. */
export interface HaloResult {
  /** Whether a valid halo (stroke or shadow) was detected. */
  hasValidHalo: boolean;
  /** Contrast ratio of the halo color against the background, or null. */
  haloContrast: number | null;
  /** The halo method that passed: 'stroke', 'shadow', or null. */
  method: 'stroke' | 'shadow' | null;
  /** Reason the halo check was skipped, if applicable. */
  skipReason: string | null;
}

/** Result of pixel-level luminance analysis on a background screenshot. */
export interface PixelAnalysisResult {
  /** Relative luminance of the lightest pixel (0–1). */
  lMax: number;
  /** Relative luminance of the darkest pixel (0–1). */
  lMin: number;
  /** RGB color of the lightest pixel. */
  lMaxColor: RGBColor;
  /** RGB color of the darkest pixel. */
  lMinColor: RGBColor;
  /** Contrast ratio of text color against the lightest background pixel. */
  crAgainstLightest: number;
  /** Contrast ratio of text color against the darkest background pixel. */
  crAgainstDarkest: number;
  /** Total opaque pixels analyzed. */
  pixelCount: number;
  /**
   * Fraction of opaque pixels whose contrast ratio against the text color
   * meets or exceeds the threshold. Range: 0–1.
   * null when threshold was not provided during analysis.
   */
  passRatio: number | null;
}

/** Computed CSS styles extracted from an element for halo analysis. */
export interface ElementComputedStyles {
  /** Foreground text `color`. */
  color: string;
  /** Computed `background-color`. */
  backgroundColor: string;
  /** `-webkit-text-stroke-width` value. */
  textStrokeWidth: string;
  /** `-webkit-text-stroke-color` value. */
  textStrokeColor: string;
  /** `text-shadow` value. */
  textShadow: string;
  /** `background-image` value (e.g. `'none'` or `'linear-gradient(...)'`). */
  backgroundImage: string;
}

/** Full result of the visual contrast analysis for a single element. */
export interface ContrastAnalysisResult {
  /** CSS selector of the analyzed element. */
  selector: string;
  /** The Safe Assessment Matrix category outcome. */
  category: ContrastCategory;
  /** Foreground text color, or null if it could not be determined. */
  textColor: RGBColor | null;
  /** The halo analysis result (fast path). */
  halo: HaloResult;
  /** The pixel analysis result (slow path), or null if halo resolved it. */
  pixels: PixelAnalysisResult | null;
  /** Human-readable explanation of the decision. */
  reason: string;
}
