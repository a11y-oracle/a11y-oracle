/**
 * @module pixel-analysis
 *
 * PNG decoding and pixel-level WCAG luminance analysis. Scans a
 * background screenshot to find the lightest and darkest pixels,
 * then calculates contrast ratios against the foreground text color.
 */

import { PNG } from 'pngjs';
import {
  relativeLuminance,
  contrastRatio,
} from '@a11y-oracle/focus-analyzer';
import type { RGBColor } from '@a11y-oracle/focus-analyzer';
import type { PixelAnalysisResult } from './types.js';

/**
 * Decode a PNG buffer into raw pixel data.
 *
 * @param buffer - A PNG-encoded buffer (e.g. from CDP screenshot).
 * @returns Width, height, and RGBA pixel data (4 bytes per pixel).
 */
export function decodePng(buffer: Buffer): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(png.data),
  };
}

/**
 * Scan an RGBA pixel buffer to find the lightest and darkest pixels
 * by relative luminance.
 *
 * Skips pixels with alpha < 255 (semi-transparent or fully transparent).
 *
 * @param data - RGBA pixel data (4 bytes per pixel).
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns The extreme luminance values and their corresponding colors,
 *          or null if no opaque pixels were found.
 */
export function findLuminanceExtremes(
  data: Uint8Array,
  width: number,
  height: number,
): {
  lMax: number;
  lMin: number;
  lMaxColor: RGBColor;
  lMinColor: RGBColor;
  pixelCount: number;
} | null {
  let lMax = -Infinity;
  let lMin = Infinity;
  let lMaxColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
  let lMinColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
  let pixelCount = 0;

  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const a = data[offset + 3];

    // Skip non-opaque pixels
    if (a < 255) continue;

    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const color: RGBColor = { r, g, b, a: 1 };
    const lum = relativeLuminance(color);

    pixelCount++;

    if (lum > lMax) {
      lMax = lum;
      lMaxColor = color;
    }
    if (lum < lMin) {
      lMin = lum;
      lMinColor = color;
    }
  }

  if (pixelCount === 0) return null;

  return { lMax, lMin, lMaxColor, lMinColor, pixelCount };
}

/**
 * Decode a PNG screenshot and analyze pixel luminance against a text color.
 *
 * Computes contrast ratios of the text color against the lightest and
 * darkest background pixels found in the image.
 *
 * @param pngBuffer - PNG-encoded screenshot of the element background.
 * @param textColor - The foreground text color to check contrast against.
 * @returns Pixel analysis result, or null if no opaque pixels were found.
 */
export function extractPixelLuminance(
  pngBuffer: Buffer,
  textColor: RGBColor,
): PixelAnalysisResult | null {
  const { width, height, data } = decodePng(pngBuffer);
  const extremes = findLuminanceExtremes(data, width, height);
  if (!extremes) return null;

  return {
    lMax: extremes.lMax,
    lMin: extremes.lMin,
    lMaxColor: extremes.lMaxColor,
    lMinColor: extremes.lMinColor,
    crAgainstLightest: contrastRatio(textColor, extremes.lMaxColor),
    crAgainstDarkest: contrastRatio(textColor, extremes.lMinColor),
    pixelCount: extremes.pixelCount,
  };
}
