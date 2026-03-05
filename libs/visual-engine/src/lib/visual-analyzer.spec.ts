import { describe, it, expect, vi } from 'vitest';
import { encode } from 'fast-png';
import { VisualContrastAnalyzer } from './visual-analyzer.js';
import type { CDPSessionLike } from '@a11y-oracle/cdp-types';

/** Create a synthetic PNG buffer from uniform color. */
function createUniformPng(
  r: number,
  g: number,
  b: number,
  width = 10,
  height = 10,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return encode({ width, height, data, channels: 4, depth: 8 });
}

/** Create a gradient PNG (left=white, right=black). */
function createGradientPng(width = 10, height = 1): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width; i++) {
    const v = Math.round(255 * (1 - i / (width - 1)));
    const offset = i * 4;
    data[offset] = v;
    data[offset + 1] = v;
    data[offset + 2] = v;
    data[offset + 3] = 255;
  }
  return encode({ width, height, data, channels: 4, depth: 8 });
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
  screenshotBuffer?: Uint8Array;
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
      return { data: Buffer.from(buf).toString('base64') };
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
    it('returns incomplete when pixel distribution is genuinely ambiguous', async () => {
      // White text on a 50/50 gradient (white→black) — half pass, half fail
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

  describe('pixel pipeline — distribution override', () => {
    it('returns pass when 95%+ of pixels pass despite one extreme failing', async () => {
      // White text on mostly-dark background with 1 light outlier pixel
      // 19 black pixels (pass) + 1 white pixel (fail) = 95% pass
      const data = new Uint8Array(20 * 1 * 4);
      for (let i = 0; i < 20; i++) {
        const offset = i * 4;
        if (i < 19) {
          // Black pixel — white text on black = ~21:1 (pass)
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        } else {
          // White pixel — white text on white = ~1:1 (fail)
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
        }
        data[offset + 3] = 255;
      }
      const screenshot = encode({ width: 20, height: 1, data, channels: 4, depth: 8 });

      const cdp = buildMockCDP({
        captureInfo: {
          color: 'rgb(255, 255, 255)',
          x: 0,
          y: 0,
          width: 20,
          height: 1,
        },
        screenshotBuffer: screenshot,
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#mostly-dark');
      expect(result.category).toBe('pass');
      expect(result.reason).toContain('pixel distribution');
      expect(result.pixels!.passRatio).toBeGreaterThanOrEqual(0.95);
    });

    it('returns violation when 95%+ of pixels fail despite one extreme passing', async () => {
      // White text on mostly-white background with 1 dark outlier pixel
      // 19 white pixels (fail) + 1 black pixel (pass) = 5% pass
      const data = new Uint8Array(20 * 1 * 4);
      for (let i = 0; i < 20; i++) {
        const offset = i * 4;
        if (i < 19) {
          // White pixel — white text on white = ~1:1 (fail)
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
        } else {
          // Black pixel — white text on black = ~21:1 (pass)
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        }
        data[offset + 3] = 255;
      }
      const screenshot = encode({ width: 20, height: 1, data, channels: 4, depth: 8 });

      const cdp = buildMockCDP({
        captureInfo: {
          color: 'rgb(255, 255, 255)',
          x: 0,
          y: 0,
          width: 20,
          height: 1,
        },
        screenshotBuffer: screenshot,
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#mostly-white');
      expect(result.category).toBe('violation');
      expect(result.reason).toContain('pixel distribution');
      expect(result.pixels!.passRatio).toBeLessThanOrEqual(0.05);
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
