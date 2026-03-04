import { describe, it, expect } from 'vitest';
import { analyzeHalo, parseTextShadow } from './halo-detector.js';
import type { ElementComputedStyles } from './types.js';

function makeStyles(overrides: Partial<ElementComputedStyles> = {}): ElementComputedStyles {
  return {
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgb(255, 255, 255)',
    textStrokeWidth: '0px',
    textStrokeColor: 'rgb(0, 0, 0)',
    textShadow: 'none',
    backgroundImage: 'none',
    ...overrides,
  };
}

describe('parseTextShadow', () => {
  it('returns empty array for "none"', () => {
    expect(parseTextShadow('none')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTextShadow('')).toEqual([]);
  });

  it('parses a single shadow with color first', () => {
    const parts = parseTextShadow('rgb(0, 0, 0) 1px 1px 0px');
    expect(parts).toHaveLength(1);
    expect(parts[0].offsetX).toBe(1);
    expect(parts[0].offsetY).toBe(1);
    expect(parts[0].blur).toBe(0);
    expect(parts[0].color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses a single shadow with color last', () => {
    const parts = parseTextShadow('1px -1px 0px #000000');
    expect(parts).toHaveLength(1);
    expect(parts[0].offsetX).toBe(1);
    expect(parts[0].offsetY).toBe(-1);
    expect(parts[0].blur).toBe(0);
  });

  it('parses multiple comma-separated shadows', () => {
    const css =
      '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
    const parts = parseTextShadow(css);
    expect(parts).toHaveLength(4);
    expect(parts[0].offsetX).toBe(1);
    expect(parts[0].offsetY).toBe(1);
    expect(parts[1].offsetX).toBe(-1);
    expect(parts[1].offsetY).toBe(-1);
    expect(parts[2].offsetX).toBe(1);
    expect(parts[2].offsetY).toBe(-1);
    expect(parts[3].offsetX).toBe(-1);
    expect(parts[3].offsetY).toBe(1);
  });

  it('parses shadow with blur radius', () => {
    const parts = parseTextShadow('2px 2px 4px #000');
    expect(parts).toHaveLength(1);
    expect(parts[0].blur).toBe(4);
  });

  it('defaults blur to 0 when omitted', () => {
    const parts = parseTextShadow('1px 1px #000');
    expect(parts).toHaveLength(1);
    expect(parts[0].blur).toBe(0);
  });

  it('defaults color to black when omitted', () => {
    const parts = parseTextShadow('1px 1px 0');
    expect(parts).toHaveLength(1);
    expect(parts[0].color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('analyzeHalo', () => {
  describe('complex background (skips halo check)', () => {
    it('skips when background-image is present', () => {
      const styles = makeStyles({
        backgroundImage: 'linear-gradient(to right, #000, #fff)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
      expect(result.skipReason).toBe('complex-background');
    });

    it('skips when background-color is transparent', () => {
      const styles = makeStyles({ backgroundColor: 'transparent' });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
      expect(result.skipReason).toBe('complex-background');
    });

    it('skips when background-color is semi-transparent', () => {
      const styles = makeStyles({ backgroundColor: 'rgba(255, 255, 255, 0.5)' });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
      expect(result.skipReason).toBe('complex-background');
    });
  });

  describe('stroke halo', () => {
    it('passes with valid stroke width and passing contrast', () => {
      const styles = makeStyles({
        textStrokeWidth: '1px',
        textStrokeColor: 'rgb(0, 0, 0)',
        backgroundColor: 'rgb(255, 255, 255)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(true);
      expect(result.method).toBe('stroke');
      expect(result.haloContrast).toBeGreaterThanOrEqual(4.5);
    });

    it('fails when stroke width < 1px', () => {
      const styles = makeStyles({
        textStrokeWidth: '0.5px',
        textStrokeColor: 'rgb(0, 0, 0)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
      expect(result.method).toBeNull();
    });

    it('fails when stroke width is 0', () => {
      const styles = makeStyles({
        textStrokeWidth: '0px',
        textStrokeColor: 'rgb(0, 0, 0)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
    });

    it('fails when stroke color does not meet contrast threshold', () => {
      // Light gray on white: ~1.16:1
      const styles = makeStyles({
        textStrokeWidth: '2px',
        textStrokeColor: 'rgb(230, 230, 230)',
        backgroundColor: 'rgb(255, 255, 255)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
    });

    it('respects custom threshold', () => {
      // Black on white is 21:1, passes 3.0 easily
      const styles = makeStyles({
        textStrokeWidth: '1px',
        textStrokeColor: 'rgb(0, 0, 0)',
      });
      const result = analyzeHalo(styles, 3.0);
      expect(result.hasValidHalo).toBe(true);
    });
  });

  describe('shadow halo', () => {
    it('passes with valid 4-direction zero-blur shadow', () => {
      const styles = makeStyles({
        textShadow:
          '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
        backgroundColor: 'rgb(255, 255, 255)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(true);
      expect(result.method).toBe('shadow');
      expect(result.haloContrast).toBeGreaterThanOrEqual(4.5);
    });

    it('fails when shadow has blur > 0', () => {
      const styles = makeStyles({
        textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
      expect(result.method).toBeNull();
    });

    it('fails when shadow covers only 2 directions', () => {
      const styles = makeStyles({
        textShadow: '1px 1px 0 #000, -1px -1px 0 #000',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
    });

    it('fails when shadow color does not meet contrast', () => {
      // Very light shadow on white
      const styles = makeStyles({
        textShadow:
          '1px 1px 0 rgb(240,240,240), -1px -1px 0 rgb(240,240,240), ' +
          '1px -1px 0 rgb(240,240,240), -1px 1px 0 rgb(240,240,240)',
        backgroundColor: 'rgb(255, 255, 255)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
    });

    it('passes when shadow origin includes 0,0 covering all quadrants', () => {
      // Shadows at (0,0) count as all quadrants
      const styles = makeStyles({
        textShadow: '0 0 0 #000',
        backgroundColor: 'rgb(255, 255, 255)',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(true);
      expect(result.method).toBe('shadow');
    });
  });

  describe('no halo', () => {
    it('returns no halo when no stroke or shadow is present', () => {
      const styles = makeStyles();
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
      expect(result.method).toBeNull();
      expect(result.skipReason).toBeNull();
    });

    it('returns no halo when text-shadow is "none"', () => {
      const styles = makeStyles({ textShadow: 'none' });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(false);
    });
  });

  describe('stroke takes priority over shadow', () => {
    it('returns stroke method when both stroke and shadow are valid', () => {
      const styles = makeStyles({
        textStrokeWidth: '1px',
        textStrokeColor: 'rgb(0, 0, 0)',
        textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
      });
      const result = analyzeHalo(styles);
      expect(result.hasValidHalo).toBe(true);
      expect(result.method).toBe('stroke');
    });
  });
});
