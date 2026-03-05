import { describe, it, expect } from 'vitest';
import { encode } from 'fast-png';
import { decodePng, findLuminanceExtremes, extractPixelLuminance } from './pixel-analysis.js';
import type { RGBColor } from '@a11y-oracle/focus-analyzer';

/** Create a synthetic PNG buffer from a flat array of RGBA pixel values. */
function createSyntheticPng(
  pixels: Array<{ r: number; g: number; b: number; a: number }>,
  width: number,
  height: number,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const offset = i * 4;
    data[offset] = pixels[i].r;
    data[offset + 1] = pixels[i].g;
    data[offset + 2] = pixels[i].b;
    data[offset + 3] = pixels[i].a;
  }
  return encode({ width, height, data, channels: 4, depth: 8 });
}

const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const BLACK = { r: 0, g: 0, b: 0, a: 255 };
const MID_GRAY = { r: 128, g: 128, b: 128, a: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

describe('decodePng', () => {
  it('decodes a 2x2 white PNG', () => {
    const buf = createSyntheticPng([WHITE, WHITE, WHITE, WHITE], 2, 2);
    const result = decodePng(buf);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.data.length).toBe(2 * 2 * 4);
  });

  it('preserves pixel values', () => {
    const buf = createSyntheticPng([BLACK, WHITE], 2, 1);
    const result = decodePng(buf);
    // First pixel: black
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
    expect(result.data[3]).toBe(255);
    // Second pixel: white
    expect(result.data[4]).toBe(255);
    expect(result.data[5]).toBe(255);
    expect(result.data[6]).toBe(255);
    expect(result.data[7]).toBe(255);
  });
});

describe('findLuminanceExtremes', () => {
  it('finds uniform white background', () => {
    const buf = createSyntheticPng([WHITE, WHITE, WHITE, WHITE], 2, 2);
    const { data, width, height } = decodePng(buf);
    const result = findLuminanceExtremes(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.lMax).toBeCloseTo(1.0, 2);
    expect(result!.lMin).toBeCloseTo(1.0, 2);
    expect(result!.pixelCount).toBe(4);
  });

  it('finds uniform black background', () => {
    const buf = createSyntheticPng([BLACK, BLACK, BLACK, BLACK], 2, 2);
    const { data, width, height } = decodePng(buf);
    const result = findLuminanceExtremes(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.lMax).toBeCloseTo(0.0, 2);
    expect(result!.lMin).toBeCloseTo(0.0, 2);
  });

  it('finds extremes in a gradient (white → black)', () => {
    const buf = createSyntheticPng([WHITE, BLACK], 2, 1);
    const { data, width, height } = decodePng(buf);
    const result = findLuminanceExtremes(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.lMax).toBeCloseTo(1.0, 2);
    expect(result!.lMin).toBeCloseTo(0.0, 2);
    expect(result!.lMaxColor).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(result!.lMinColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('skips semi-transparent pixels', () => {
    const semiTransparent = { r: 255, g: 0, b: 0, a: 128 };
    const buf = createSyntheticPng([semiTransparent, BLACK], 2, 1);
    const { data, width, height } = decodePng(buf);
    const result = findLuminanceExtremes(data, width, height);
    expect(result).not.toBeNull();
    // Only the black pixel should be counted
    expect(result!.pixelCount).toBe(1);
  });

  it('returns null for all-transparent image', () => {
    const buf = createSyntheticPng([TRANSPARENT, TRANSPARENT], 2, 1);
    const { data, width, height } = decodePng(buf);
    const result = findLuminanceExtremes(data, width, height);
    expect(result).toBeNull();
  });

  it('handles 1x1 pixel image', () => {
    const buf = createSyntheticPng([MID_GRAY], 1, 1);
    const { data, width, height } = decodePng(buf);
    const result = findLuminanceExtremes(data, width, height);
    expect(result).not.toBeNull();
    expect(result!.pixelCount).toBe(1);
    expect(result!.lMax).toBe(result!.lMin);
  });
});

describe('extractPixelLuminance', () => {
  it('calculates contrast ratios for black text on white background', () => {
    const textColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
    const buf = createSyntheticPng([WHITE, WHITE], 2, 1);
    const result = extractPixelLuminance(buf, textColor);
    expect(result).not.toBeNull();
    // Black text on white bg: ~21:1
    expect(result!.crAgainstLightest).toBeCloseTo(21, 0);
    expect(result!.crAgainstDarkest).toBeCloseTo(21, 0);
    // No threshold provided → passRatio is null
    expect(result!.passRatio).toBeNull();
  });

  it('calculates contrast ratios for white text on gradient', () => {
    const textColor: RGBColor = { r: 255, g: 255, b: 255, a: 1 };
    const buf = createSyntheticPng([WHITE, BLACK], 2, 1);
    const result = extractPixelLuminance(buf, textColor);
    expect(result).not.toBeNull();
    // White on white: ~1:1
    expect(result!.crAgainstLightest).toBeCloseTo(1, 0);
    // White on black: ~21:1
    expect(result!.crAgainstDarkest).toBeCloseTo(21, 0);
    expect(result!.passRatio).toBeNull();
  });

  it('returns null for all-transparent screenshot', () => {
    const textColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
    const buf = createSyntheticPng([TRANSPARENT], 1, 1);
    const result = extractPixelLuminance(buf, textColor);
    expect(result).toBeNull();
  });

  it('calculates mid-gray background contrast correctly', () => {
    const textColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
    const buf = createSyntheticPng([MID_GRAY, MID_GRAY], 2, 1);
    const result = extractPixelLuminance(buf, textColor);
    expect(result).not.toBeNull();
    // Black text on mid-gray: moderate contrast
    expect(result!.crAgainstLightest).toBeGreaterThan(4);
    expect(result!.crAgainstLightest).toBeLessThan(10);
  });

  describe('passRatio', () => {
    it('returns 1.0 when all pixels pass threshold', () => {
      const textColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
      const buf = createSyntheticPng([WHITE, WHITE, WHITE, WHITE], 2, 2);
      const result = extractPixelLuminance(buf, textColor, 4.5);
      expect(result).not.toBeNull();
      expect(result!.passRatio).toBe(1.0);
    });

    it('returns 0.0 when no pixels pass threshold', () => {
      // White text on white background — 1:1 contrast, fails any threshold
      const textColor: RGBColor = { r: 255, g: 255, b: 255, a: 1 };
      const buf = createSyntheticPng([WHITE, WHITE], 2, 1);
      const result = extractPixelLuminance(buf, textColor, 4.5);
      expect(result).not.toBeNull();
      expect(result!.passRatio).toBe(0.0);
    });

    it('returns correct ratio for mixed background', () => {
      // Black text on: 9 white pixels (pass ~21:1) + 1 light gray pixel
      // The light gray might still pass 4.5 depending on exact color
      const textColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
      const pixels = Array(9).fill(WHITE).concat([BLACK]);
      const buf = createSyntheticPng(pixels, 10, 1);
      const result = extractPixelLuminance(buf, textColor, 4.5);
      expect(result).not.toBeNull();
      // Black text on black pixel: ~1:1 (fails), on white: ~21:1 (passes)
      // 9 of 10 pass = 0.9
      expect(result!.passRatio).toBeCloseTo(0.9, 2);
    });

    it('skips transparent pixels in ratio calculation', () => {
      const textColor: RGBColor = { r: 0, g: 0, b: 0, a: 1 };
      const pixels = [WHITE, WHITE, TRANSPARENT, TRANSPARENT];
      const buf = createSyntheticPng(pixels, 2, 2);
      const result = extractPixelLuminance(buf, textColor, 4.5);
      expect(result).not.toBeNull();
      // Only 2 opaque pixels, both pass → 1.0
      expect(result!.passRatio).toBe(1.0);
      expect(result!.pixelCount).toBe(2);
    });
  });
});
