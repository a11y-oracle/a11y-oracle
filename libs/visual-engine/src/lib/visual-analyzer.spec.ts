import { describe, it, expect, vi } from 'vitest';
import { PNG } from 'pngjs';
import { VisualContrastAnalyzer } from './visual-analyzer.js';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';

/** Create a synthetic PNG buffer from uniform color. */
function createUniformPng(
  r: number,
  g: number,
  b: number,
  width = 10,
  height = 10,
): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    png.data[offset] = r;
    png.data[offset + 1] = g;
    png.data[offset + 2] = b;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
}

/** Create a gradient PNG (left=white, right=black). */
function createGradientPng(width = 10, height = 1): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width; i++) {
    const v = Math.round(255 * (1 - i / (width - 1)));
    const offset = i * 4;
    png.data[offset] = v;
    png.data[offset + 1] = v;
    png.data[offset + 2] = v;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
}

type SendFn = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<unknown>;

function createMockCDP(sendImpl: SendFn): CDPSessionLike {
  return { send: sendImpl } as CDPSessionLike;
}

/**
 * Build a mock CDP that returns predefined styles, bounding box,
 * and screenshot data.
 */
function buildMockCDP(opts: {
  styles?: Record<string, string> | null;
  isDynamic?: boolean;
  captureInfo?: {
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  screenshotBuffer?: Buffer;
}): CDPSessionLike {
  const defaultStyles = {
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'transparent',
    textStrokeWidth: '0px',
    textStrokeColor: '',
    textShadow: 'none',
    backgroundImage: 'none',
  };
  const defaultCapture = {
    color: 'rgb(0, 0, 0)',
    x: 0,
    y: 0,
    width: 100,
    height: 20,
  };

  let callIndex = 0;
  const runtimeCalls: string[] = [];

  return createMockCDP(async (method: string) => {
    if (method === 'Runtime.evaluate') {
      const idx = callIndex++;

      if (idx === 0) {
        // getElementStyles
        return {
          result: {
            value: 'styles' in opts ? opts.styles : defaultStyles,
          },
        };
      }
      if (idx === 1) {
        // isDynamicContent
        return { result: { value: opts.isDynamic ?? false } };
      }
      if (idx === 2) {
        // getCaptureInfoAndHide
        return {
          result: {
            value: 'captureInfo' in opts ? opts.captureInfo : defaultCapture,
          },
        };
      }
      // restoreText
      return { result: { value: true } };
    }

    if (method === 'Page.captureScreenshot') {
      const buf = opts.screenshotBuffer ?? createUniformPng(255, 255, 255);
      return { data: buf.toString('base64') };
    }

    return {};
  });
}

describe('VisualContrastAnalyzer', () => {
  describe('element not found', () => {
    it('returns incomplete when element is null', async () => {
      const cdp = buildMockCDP({ styles: null });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#missing');
      expect(result.category).toBe('incomplete');
      expect(result.reason).toContain('not found');
    });
  });

  describe('dynamic content', () => {
    it('returns incomplete for video/canvas elements', async () => {
      const cdp = buildMockCDP({ isDynamic: true });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#video-text');
      expect(result.category).toBe('incomplete');
      expect(result.reason).toContain('Dynamic');
    });
  });

  describe('halo fast path', () => {
    it('returns pass when valid stroke halo is detected', async () => {
      const cdp = buildMockCDP({
        styles: {
          color: 'rgb(150, 150, 150)',
          backgroundColor: 'rgb(255, 255, 255)',
          textStrokeWidth: '1px',
          textStrokeColor: 'rgb(0, 0, 0)',
          textShadow: 'none',
          backgroundImage: 'none',
        },
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#halo-text');
      expect(result.category).toBe('pass');
      expect(result.halo.method).toBe('stroke');
      expect(result.pixels).toBeNull(); // No screenshot needed
    });
  });

  describe('pixel pipeline — pass', () => {
    it('returns pass when text has good contrast against uniform background', async () => {
      // Black text on white background
      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(0, 0, 0)', x: 0, y: 0, width: 10, height: 10 },
        screenshotBuffer: createUniformPng(255, 255, 255),
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#good-contrast');
      expect(result.category).toBe('pass');
      expect(result.pixels).not.toBeNull();
      expect(result.pixels!.crAgainstLightest).toBeGreaterThan(4.5);
    });
  });

  describe('pixel pipeline — violation', () => {
    it('returns violation when text fails contrast against all background pixels', async () => {
      // White text on white background (no contrast)
      const cdp = buildMockCDP({
        captureInfo: {
          color: 'rgb(255, 255, 255)',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
        screenshotBuffer: createUniformPng(255, 255, 255),
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#bad-contrast');
      expect(result.category).toBe('violation');
      expect(result.reason).toContain('Fails best-case');
    });
  });

  describe('pixel pipeline — split decision', () => {
    it('returns incomplete when contrast passes one extreme but fails the other', async () => {
      // White text on gradient (white→black)
      const cdp = buildMockCDP({
        captureInfo: {
          color: 'rgb(255, 255, 255)',
          x: 0,
          y: 0,
          width: 10,
          height: 1,
        },
        screenshotBuffer: createGradientPng(10, 1),
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#gradient-text');
      expect(result.category).toBe('incomplete');
      expect(result.reason).toContain('Split decision');
    });
  });

  describe('capture failure', () => {
    it('returns incomplete when capture returns null', async () => {
      const cdp = buildMockCDP({
        captureInfo: null,
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#no-capture');
      expect(result.category).toBe('incomplete');
      expect(result.reason).toContain('Could not capture');
    });
  });

  describe('threshold customization', () => {
    it('uses custom threshold for large text (3.0)', async () => {
      // Gray text on white: ~3.84:1 — fails 4.5 but passes 3.0
      const mockOpts = {
        captureInfo: {
          color: 'rgb(130, 130, 130)',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
        screenshotBuffer: createUniformPng(255, 255, 255),
      };

      // Strict threshold (4.5) — should fail
      const cdp1 = buildMockCDP(mockOpts);
      const resultStrict = await new VisualContrastAnalyzer(cdp1).analyzeElement('#gray-text', 4.5);
      expect(resultStrict.category).toBe('violation');

      // Large text threshold (3.0) — should pass
      const cdp2 = buildMockCDP(mockOpts);
      const resultLarge = await new VisualContrastAnalyzer(cdp2).analyzeElement('#gray-text', 3.0);
      expect(resultLarge.category).toBe('pass');
    });
  });
});
