import { describe, it, expect } from 'vitest';
import { srgbToLinear, relativeLuminance, contrastRatio, meetsAA } from './contrast.js';

describe('srgbToLinear', () => {
  it('converts 0 to 0', () => {
    expect(srgbToLinear(0)).toBe(0);
  });

  it('converts 255 to 1', () => {
    expect(srgbToLinear(255)).toBeCloseTo(1, 5);
  });

  it('converts 128 to approximately 0.2158', () => {
    // 128/255 ≈ 0.502, which is > 0.04045
    // ((0.502 + 0.055) / 1.055) ^ 2.4 ≈ 0.2158
    expect(srgbToLinear(128)).toBeCloseTo(0.2158, 3);
  });

  it('converts low values using linear formula', () => {
    // 10/255 ≈ 0.0392, which is < 0.04045
    // 0.0392 / 12.92 ≈ 0.00304
    expect(srgbToLinear(10)).toBeCloseTo(0.00304, 4);
  });
});

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1, 4);
  });

  it('returns approximately 0.2126 for pure red', () => {
    expect(relativeLuminance({ r: 255, g: 0, b: 0, a: 1 })).toBeCloseTo(0.2126, 3);
  });

  it('returns approximately 0.7152 for pure green', () => {
    expect(relativeLuminance({ r: 0, g: 255, b: 0, a: 1 })).toBeCloseTo(0.7152, 3);
  });

  it('returns approximately 0.0722 for pure blue', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 255, a: 1 })).toBeCloseTo(0.0722, 3);
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });

  it('returns 21:1 for white on black (order independent)', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for same color', () => {
    const blue = { r: 52, g: 152, b: 219, a: 1 };
    expect(contrastRatio(blue, blue)).toBeCloseTo(1, 2);
  });

  it('returns 1:1 for white on white', () => {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrastRatio(white, white)).toBeCloseTo(1, 2);
  });

  it('calculates ratio for #3498db on #2c3e50', () => {
    // These are the actual colors from the sandbox CSS:
    // Focus outline: #3498db, menubar background: #2c3e50
    const focusBlue = { r: 52, g: 152, b: 219, a: 1 };
    const darkBg = { r: 44, g: 62, b: 80, a: 1 };
    const ratio = contrastRatio(focusBlue, darkBg);
    // Should be > 3.0 for WCAG AA
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(10);
  });

  it('calculates a high ratio for bright color on dark background', () => {
    const yellow = { r: 255, g: 255, b: 0, a: 1 };
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const ratio = contrastRatio(yellow, black);
    expect(ratio).toBeGreaterThan(15);
  });
});

describe('meetsAA', () => {
  it('returns true for ratio >= 3.0', () => {
    expect(meetsAA(3.0)).toBe(true);
    expect(meetsAA(4.5)).toBe(true);
    expect(meetsAA(21)).toBe(true);
  });

  it('returns false for ratio < 3.0', () => {
    expect(meetsAA(2.99)).toBe(false);
    expect(meetsAA(1.0)).toBe(false);
    expect(meetsAA(2.5)).toBe(false);
  });

  it('returns true for exactly 3.0', () => {
    expect(meetsAA(3.0)).toBe(true);
  });
});
