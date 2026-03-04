/**
 * @module halo-detector
 *
 * CSS halo heuristic for WCAG color contrast. WCAG allows a text
 * stroke or shadow to serve as the contrast boundary. This module
 * evaluates computed CSS styles to determine if a valid halo exists
 * before falling back to the more expensive pixel analysis pipeline.
 */

import { parseColor, contrastRatio } from '@a11y-oracle/focus-analyzer';
import type { RGBColor } from '@a11y-oracle/focus-analyzer';
import type { ElementComputedStyles, HaloResult, TextShadowPart } from './types.js';

/** Default WCAG AA contrast threshold for normal text. */
const DEFAULT_THRESHOLD = 4.5;

/**
 * Analyze an element's computed styles for a valid CSS halo.
 *
 * A halo is valid when:
 * - `-webkit-text-stroke-width` >= 1px with a stroke color that passes
 *   the contrast threshold against the background, OR
 * - `text-shadow` has 0-blur, multi-directional coverage (4+ quadrants),
 *   and a shadow color that passes the threshold.
 *
 * If the background is complex (transparent, gradient, or image),
 * the halo check is skipped entirely.
 *
 * @param styles - Computed CSS styles from the element.
 * @param threshold - Minimum contrast ratio. Default: 4.5 (WCAG AA).
 */
export function analyzeHalo(
  styles: ElementComputedStyles,
  threshold: number = DEFAULT_THRESHOLD,
): HaloResult {
  const noHalo: HaloResult = {
    hasValidHalo: false,
    haloContrast: null,
    method: null,
    skipReason: null,
  };

  // Check if background is complex (can't resolve halo via CSS alone)
  if (isBackgroundComplex(styles)) {
    return { ...noHalo, skipReason: 'complex-background' };
  }

  const bgColor = parseColor(styles.backgroundColor);
  if (!bgColor) {
    return { ...noHalo, skipReason: 'unparseable-background' };
  }

  // Check text-stroke first (simpler, more reliable)
  const strokeResult = checkStroke(styles, bgColor, threshold);
  if (strokeResult) return strokeResult;

  // Check text-shadow
  const shadowResult = checkShadow(styles, bgColor, threshold);
  if (shadowResult) return shadowResult;

  return noHalo;
}

/**
 * Parse a CSS `text-shadow` value into structured parts.
 *
 * Handles the standard CSS syntax where each shadow is:
 *   `[color] <offset-x> <offset-y> [blur-radius]`
 * or
 *   `<offset-x> <offset-y> [blur-radius] [color]`
 *
 * Multiple shadows are comma-separated.
 *
 * @param css - The raw `text-shadow` CSS value.
 * @returns Array of parsed shadow parts. Empty if `none` or unparseable.
 */
export function parseTextShadow(css: string): TextShadowPart[] {
  if (!css || css.trim().toLowerCase() === 'none') return [];

  const shadows = splitShadows(css);
  const parts: TextShadowPart[] = [];

  for (const shadow of shadows) {
    const parsed = parseSingleShadow(shadow.trim());
    if (parsed) parts.push(parsed);
  }

  return parts;
}

/**
 * Check if the background is too complex for CSS-only halo analysis.
 */
function isBackgroundComplex(styles: ElementComputedStyles): boolean {
  // Background image present (gradient, url(), etc.)
  if (styles.backgroundImage && styles.backgroundImage !== 'none') {
    return true;
  }

  // Background color is transparent or semi-transparent
  const bgColor = parseColor(styles.backgroundColor);
  if (!bgColor || bgColor.a < 1) {
    return true;
  }

  return false;
}

/**
 * Check if `-webkit-text-stroke` qualifies as a valid halo.
 */
function checkStroke(
  styles: ElementComputedStyles,
  bgColor: RGBColor,
  threshold: number,
): HaloResult | null {
  const width = parseFloat(styles.textStrokeWidth);
  if (isNaN(width) || width < 1) return null;

  const strokeColor = parseColor(styles.textStrokeColor);
  if (!strokeColor || strokeColor.a < 1) return null;

  const cr = contrastRatio(strokeColor, bgColor);
  if (cr >= threshold) {
    return {
      hasValidHalo: true,
      haloContrast: cr,
      method: 'stroke',
      skipReason: null,
    };
  }

  return null;
}

/**
 * Check if `text-shadow` qualifies as a valid halo.
 *
 * Requirements:
 * 1. All shadows must have blur radius of 0.
 * 2. Shadows must cover at least 4 directions (all quadrants).
 * 3. All shadow colors must pass the contrast threshold.
 */
function checkShadow(
  styles: ElementComputedStyles,
  bgColor: RGBColor,
  threshold: number,
): HaloResult | null {
  const parts = parseTextShadow(styles.textShadow);
  if (parts.length === 0) return null;

  // Any blur > 0 disqualifies the entire shadow as a halo
  if (parts.some((p) => p.blur > 0)) return null;

  // Must cover all 4 quadrants
  if (!coversAllQuadrants(parts)) return null;

  // All shadow colors must pass contrast
  let minContrast = Infinity;
  for (const part of parts) {
    if (part.color.a < 1) return null;
    const cr = contrastRatio(part.color, bgColor);
    minContrast = Math.min(minContrast, cr);
  }

  if (minContrast >= threshold) {
    return {
      hasValidHalo: true,
      haloContrast: minContrast,
      method: 'shadow',
      skipReason: null,
    };
  }

  return null;
}

/**
 * Check if shadow parts cover all 4 directional quadrants
 * (top-left, top-right, bottom-left, bottom-right).
 */
function coversAllQuadrants(parts: TextShadowPart[]): boolean {
  let hasTopLeft = false;
  let hasTopRight = false;
  let hasBottomLeft = false;
  let hasBottomRight = false;

  for (const p of parts) {
    if (p.offsetX <= 0 && p.offsetY <= 0) hasTopLeft = true;
    if (p.offsetX >= 0 && p.offsetY <= 0) hasTopRight = true;
    if (p.offsetX <= 0 && p.offsetY >= 0) hasBottomLeft = true;
    if (p.offsetX >= 0 && p.offsetY >= 0) hasBottomRight = true;
  }

  return hasTopLeft && hasTopRight && hasBottomLeft && hasBottomRight;
}

/**
 * Split a CSS text-shadow value by commas, respecting parentheses.
 * Commas inside `rgb()` / `rgba()` are not treated as separators.
 */
function splitShadows(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < css.length; i++) {
    if (css[i] === '(') depth++;
    else if (css[i] === ')') depth--;
    else if (css[i] === ',' && depth === 0) {
      parts.push(css.substring(start, i));
      start = i + 1;
    }
  }

  parts.push(css.substring(start));
  return parts;
}

/**
 * Parse a single text-shadow value (one of possibly many comma-separated).
 *
 * Format: `[color] <offset-x> <offset-y> [blur] [color]`
 * The color can appear before or after the numeric values.
 */
function parseSingleShadow(raw: string): TextShadowPart | null {
  if (!raw) return null;

  let remaining = raw;
  let color: RGBColor | null = null;

  // Extract color first — it can be rgb()/rgba() or #hex
  // Try rgb()/rgba() first
  const rgbRegex = /rgba?\([^)]+\)/i;
  const rgbMatch = remaining.match(rgbRegex);
  if (rgbMatch) {
    color = parseColor(rgbMatch[0]);
    remaining = remaining.replace(rgbMatch[0], '');
  } else {
    // Try hex color
    const hexRegex = /#[0-9a-f]{3,8}/i;
    const hexMatch = remaining.match(hexRegex);
    if (hexMatch) {
      color = parseColor(hexMatch[0]);
      remaining = remaining.replace(hexMatch[0], '');
    }
  }

  // Extract numeric values from the remainder (px values)
  const numericRegex = /-?[\d.]+(?:px)?/g;
  const numbers: number[] = [];
  let numericMatch: RegExpExecArray | null;

  while ((numericMatch = numericRegex.exec(remaining)) !== null) {
    numbers.push(parseFloat(numericMatch[0]));
  }

  // Need at least 2 numbers (offsetX, offsetY)
  if (numbers.length < 2) return null;

  const offsetX = numbers[0];
  const offsetY = numbers[1];
  const blur = numbers.length >= 3 ? numbers[2] : 0;

  // Default to black if no color found
  if (!color) color = parseColor('#000000');
  if (!color) return null;

  return { offsetX, offsetY, blur, color };
}
