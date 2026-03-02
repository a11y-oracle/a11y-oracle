import { describe, it, expect } from 'vitest';
import { parseColor } from './color-parser.js';

describe('parseColor', () => {
  describe('rgb()', () => {
    it('parses rgb(255, 0, 0)', () => {
      expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('parses rgb(0, 128, 255)', () => {
      expect(parseColor('rgb(0, 128, 255)')).toEqual({ r: 0, g: 128, b: 255, a: 1 });
    });

    it('parses rgb(0, 0, 0)', () => {
      expect(parseColor('rgb(0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    it('parses rgb(255, 255, 255)', () => {
      expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });
  });

  describe('rgba()', () => {
    it('parses rgba(0, 128, 255, 0.5)', () => {
      expect(parseColor('rgba(0, 128, 255, 0.5)')).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
    });

    it('parses rgba(255, 0, 0, 1)', () => {
      expect(parseColor('rgba(255, 0, 0, 1)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('parses rgba(0, 0, 0, 0)', () => {
      expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });
  });

  describe('modern space-separated rgb()', () => {
    it('parses rgb(255 0 0)', () => {
      expect(parseColor('rgb(255 0 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('parses rgb(52 152 219 / 0.8)', () => {
      expect(parseColor('rgb(52 152 219 / 0.8)')).toEqual({ r: 52, g: 152, b: 219, a: 0.8 });
    });
  });

  describe('#hex', () => {
    it('parses 6-digit hex #ff0000', () => {
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('parses 6-digit hex #3498db', () => {
      expect(parseColor('#3498db')).toEqual({ r: 52, g: 152, b: 219, a: 1 });
    });

    it('parses 3-digit hex #f00', () => {
      expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('parses 3-digit hex #000', () => {
      expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    it('parses 3-digit hex #fff', () => {
      expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('parses 8-digit hex #ff000080', () => {
      const result = parseColor('#ff000080');
      expect(result!.r).toBe(255);
      expect(result!.g).toBe(0);
      expect(result!.b).toBe(0);
      expect(result!.a).toBeCloseTo(0.502, 2);
    });

    it('parses 4-digit hex #f00f', () => {
      expect(parseColor('#f00f')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('handles uppercase hex #FF0000', () => {
      expect(parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });
  });

  describe('transparent', () => {
    it('parses transparent', () => {
      expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('parses TRANSPARENT (case insensitive)', () => {
      expect(parseColor('TRANSPARENT')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseColor('')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseColor(null as unknown as string)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseColor(undefined as unknown as string)).toBeNull();
    });

    it('returns null for unrecognized format', () => {
      expect(parseColor('red')).toBeNull();
    });

    it('returns null for hsl() (not supported)', () => {
      expect(parseColor('hsl(0, 100%, 50%)')).toBeNull();
    });

    it('handles whitespace around value', () => {
      expect(parseColor('  rgb(255, 0, 0)  ')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('clamps values above 255', () => {
      const result = parseColor('rgb(300, 0, 0)');
      expect(result!.r).toBe(255);
    });
  });
});
