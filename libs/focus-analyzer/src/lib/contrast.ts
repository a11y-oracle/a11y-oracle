/**
 * @module contrast
 *
 * WCAG 2.x relative luminance and contrast ratio calculations.
 *
 * Implements the formulas from:
 * - {@link https://www.w3.org/TR/WCAG21/#dfn-relative-luminance | WCAG 2.1 Relative Luminance}
 * - {@link https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio | WCAG 2.1 Contrast Ratio}
 */

import type { RGBColor } from './types.js';

/**
 * Convert an sRGB channel value (0–255) to linear RGB.
 *
 * Applies the sRGB inverse companding function:
 * - If sRGB <= 0.04045: linear = sRGB / 12.92
 * - Otherwise: linear = ((sRGB + 0.055) / 1.055) ^ 2.4
 *
 * @param channel - sRGB channel value in range [0, 255].
 * @returns Linear RGB value in range [0, 1].
 */
export function srgbToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculate the WCAG relative luminance of a color.
 *
 * Formula: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where R, G, B are linearized sRGB channel values.
 *
 * @param color - The RGB color.
 * @returns Relative luminance in range [0, 1].
 *          0 = darkest black, 1 = lightest white.
 */
export function relativeLuminance(color: RGBColor): number {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate the WCAG contrast ratio between two colors.
 *
 * Formula: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter luminance and L2 is the darker.
 *
 * @param foreground - The foreground (indicator) color.
 * @param background - The background color.
 * @returns Contrast ratio in range [1, 21].
 *          1:1 = no contrast, 21:1 = maximum contrast.
 */
export function contrastRatio(foreground: RGBColor, background: RGBColor): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a contrast ratio meets WCAG 2.4.12 AA for focus indicators.
 *
 * WCAG 2.4.12 requires a minimum 3:1 contrast ratio for focus indicators.
 *
 * @param ratio - The contrast ratio.
 * @returns `true` if the ratio meets or exceeds 3.0.
 */
export function meetsAA(ratio: number): boolean {
  return ratio >= 3.0;
}
