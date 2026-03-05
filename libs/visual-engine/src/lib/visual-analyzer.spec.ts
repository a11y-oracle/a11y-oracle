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
      // Disable supermajority and best-case override to test pure split
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
      const analyzer = new VisualContrastAnalyzer(cdp, {
        supermajorityPassRatio: 1.0,
        bestCaseMultiplier: Infinity,
      });
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

  describe('pixel pipeline — supermajority pass', () => {
    /**
     * Create a screenshot where a controlled fraction of pixels pass.
     * For white text (255,255,255): black pixels pass (~21:1), white pixels fail (~1:1).
     */
    function createMixedScreenshot(totalPixels: number, passingFraction: number): Uint8Array {
      const passingCount = Math.round(totalPixels * passingFraction);
      const data = new Uint8Array(totalPixels * 4);
      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        if (i < passingCount) {
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
      return encode({ width: totalPixels, height: 1, data, channels: 4, depth: 8 });
    }

    it('returns pass when 80% of pixels pass (above default 75% supermajority)', async () => {
      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(255, 255, 255)', x: 0, y: 0, width: 100, height: 1 },
        screenshotBuffer: createMixedScreenshot(100, 0.80),
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#nav-gradient');
      expect(result.category).toBe('pass');
      expect(result.reason).toContain('supermajority');
    });

    it('stays incomplete when 60% of pixels pass (below 75% supermajority) and best-case override disabled', async () => {
      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(255, 255, 255)', x: 0, y: 0, width: 100, height: 1 },
        screenshotBuffer: createMixedScreenshot(100, 0.60),
      });
      // Disable best-case override to isolate the supermajority check
      const analyzer = new VisualContrastAnalyzer(cdp, {
        bestCaseMultiplier: Infinity,
      });
      const result = await analyzer.analyzeElement('#partial-gradient');
      expect(result.category).toBe('incomplete');
      expect(result.reason).toContain('Split decision');
    });

    it('respects custom supermajority ratio', async () => {
      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(255, 255, 255)', x: 0, y: 0, width: 100, height: 1 },
        screenshotBuffer: createMixedScreenshot(100, 0.88),
      });
      // Set a strict 90% supermajority — 88% should NOT pass
      const analyzer = new VisualContrastAnalyzer(cdp, {
        supermajorityPassRatio: 0.90,
        bestCaseMultiplier: Infinity,
      });
      const result = await analyzer.analyzeElement('#strict-supermajority');
      expect(result.category).toBe('incomplete');
    });
  });

  describe('pixel pipeline — best-case override', () => {
    it('returns pass when best CR exceeds threshold × 2 despite low pass ratio', async () => {
      // Dark text (rgb(17,24,39) = text-gray-900) on mostly-dark bg with a few white pixels
      // White bg pixel: CR against text-gray-900 ≈ 16:1 (>> 4.5 × 2 = 9.0)
      // Dark bg pixels: CR ≈ 1:1 (fail)
      // 10% pass — too low for supermajority, but best-case CR >> threshold × 2
      const totalPixels = 100;
      const data = new Uint8Array(totalPixels * 4);
      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        if (i < 10) {
          // White pixel (pass: ~16:1 against dark text)
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
        } else {
          // Near-black pixel (fail: ~1:1 against dark text)
          data[offset] = 20;
          data[offset + 1] = 20;
          data[offset + 2] = 20;
        }
        data[offset + 3] = 255;
      }
      const screenshot = encode({ width: totalPixels, height: 1, data, channels: 4, depth: 8 });

      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(17, 24, 39)', x: 0, y: 0, width: 100, height: 1 },
        screenshotBuffer: screenshot,
      });
      const analyzer = new VisualContrastAnalyzer(cdp);
      const result = await analyzer.analyzeElement('#overlap-false-positive');
      expect(result.category).toBe('pass');
      expect(result.reason).toContain('best-case override');
    });

    it('stays incomplete when best CR does not exceed threshold × multiplier', async () => {
      // Text with moderate contrast — best case only slightly above threshold
      // Gray text on mixed bg: best CR ~5.5 (< 4.5 × 2 = 9.0)
      const totalPixels = 100;
      const data = new Uint8Array(totalPixels * 4);
      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        if (i < 10) {
          // White pixel (pass for gray text)
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
        } else {
          // Near-gray pixel (fail for gray text)
          data[offset] = 150;
          data[offset + 1] = 150;
          data[offset + 2] = 150;
        }
        data[offset + 3] = 255;
      }
      const screenshot = encode({ width: totalPixels, height: 1, data, channels: 4, depth: 8 });

      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(100, 100, 100)', x: 0, y: 0, width: 100, height: 1 },
        screenshotBuffer: screenshot,
      });
      const analyzer = new VisualContrastAnalyzer(cdp, {
        supermajorityPassRatio: 1.0,  // disable supermajority
      });
      const result = await analyzer.analyzeElement('#low-contrast-gradient');
      expect(result.category).toBe('incomplete');
    });

    it('respects custom bestCaseMultiplier', async () => {
      // Dark text on mostly-dark bg with white pixels — best CR ~16
      // With multiplier 4.0: threshold × 4 = 18.0 → 16 < 18 → should NOT pass
      const totalPixels = 100;
      const data = new Uint8Array(totalPixels * 4);
      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        if (i < 10) {
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
        } else {
          data[offset] = 20;
          data[offset + 1] = 20;
          data[offset + 2] = 20;
        }
        data[offset + 3] = 255;
      }
      const screenshot = encode({ width: totalPixels, height: 1, data, channels: 4, depth: 8 });

      const cdp = buildMockCDP({
        captureInfo: { color: 'rgb(17, 24, 39)', x: 0, y: 0, width: 100, height: 1 },
        screenshotBuffer: screenshot,
      });
      const analyzer = new VisualContrastAnalyzer(cdp, {
        supermajorityPassRatio: 1.0,
        bestCaseMultiplier: 4.0,
      });
      const result = await analyzer.analyzeElement('#strict-best-case');
      expect(result.category).toBe('incomplete');
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
