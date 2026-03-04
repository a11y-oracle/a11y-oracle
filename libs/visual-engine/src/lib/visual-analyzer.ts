/**
 * @module visual-analyzer
 *
 * Coordinator class that runs the full visual contrast analysis pipeline:
 * halo heuristic → dynamic content check → pixel analysis → Safe Assessment Matrix.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { ContrastAnalysisResult, HaloResult } from './types.js';
import { analyzeHalo } from './halo-detector.js';
import { extractPixelLuminance } from './pixel-analysis.js';
import {
  getElementStyles,
  captureElementBackground,
  isDynamicContent,
} from './screenshot.js';

/** Default WCAG AA contrast threshold for normal text. */
const DEFAULT_THRESHOLD = 4.5;

const NO_HALO: HaloResult = {
  hasValidHalo: false,
  haloContrast: null,
  method: null,
  skipReason: null,
};

/**
 * Visual contrast analyzer that coordinates the halo-then-pixel pipeline
 * for resolving incomplete color contrast warnings.
 *
 * @example
 * ```typescript
 * const analyzer = new VisualContrastAnalyzer(cdpSession);
 * const result = await analyzer.analyzeElement('#my-text', 4.5);
 * if (result.category === 'pass') {
 *   // Safe to filter out
 * }
 * ```
 */
export class VisualContrastAnalyzer {
  constructor(private cdp: CDPSessionLike) {}

  /**
   * Analyze a single element's color contrast using the full pipeline.
   *
   * Pipeline order:
   * 1. Get computed styles
   * 2. Check for dynamic/temporal content (video, canvas, opacity)
   * 3. Try CSS halo heuristic (fast path)
   * 4. Capture background screenshot with text hidden
   * 5. Pixel-level luminance analysis
   * 6. Apply Safe Assessment Matrix
   *
   * @param selector - CSS selector targeting the element.
   * @param threshold - Minimum contrast ratio. Default: 4.5 (WCAG AA).
   * @returns The analysis result with category, metrics, and explanation.
   */
  async analyzeElement(
    selector: string,
    threshold: number = DEFAULT_THRESHOLD,
  ): Promise<ContrastAnalysisResult> {
    // Step 1: Get computed styles
    const styles = await getElementStyles(this.cdp, selector);
    if (!styles) {
      return {
        selector,
        category: 'incomplete',
        textColor: null,
        halo: NO_HALO,
        pixels: null,
        reason: 'Element not found',
      };
    }

    // Step 2: Check for dynamic/temporal content
    const dynamic = await isDynamicContent(this.cdp, selector);
    if (dynamic) {
      return {
        selector,
        category: 'incomplete',
        textColor: null,
        halo: NO_HALO,
        pixels: null,
        reason: 'Dynamic or temporal content detected (video, canvas, opacity, or blend mode)',
      };
    }

    // Step 3: Try halo heuristic (CSS-only fast path)
    const halo = analyzeHalo(styles, threshold);
    if (halo.hasValidHalo) {
      return {
        selector,
        category: 'pass',
        textColor: null,
        halo,
        pixels: null,
        reason: `Valid CSS halo detected via ${halo.method} (contrast: ${halo.haloContrast?.toFixed(2)})`,
      };
    }

    // Step 4: Capture background screenshot
    const capture = await captureElementBackground(this.cdp, selector);
    if (!capture) {
      return {
        selector,
        category: 'incomplete',
        textColor: null,
        halo,
        pixels: null,
        reason: 'Could not capture element background',
      };
    }

    if (!capture.textColor) {
      return {
        selector,
        category: 'incomplete',
        textColor: null,
        halo,
        pixels: null,
        reason: 'Could not determine foreground text color',
      };
    }

    // Step 5: Pixel-level luminance analysis
    const pixels = extractPixelLuminance(capture.pngBuffer, capture.textColor);
    if (!pixels) {
      return {
        selector,
        category: 'incomplete',
        textColor: capture.textColor,
        halo,
        pixels: null,
        reason: 'No opaque pixels found in background screenshot',
      };
    }

    // Step 6: Safe Assessment Matrix
    const passesLightest = pixels.crAgainstLightest >= threshold;
    const passesDarkest = pixels.crAgainstDarkest >= threshold;

    if (passesLightest && passesDarkest) {
      return {
        selector,
        category: 'pass',
        textColor: capture.textColor,
        halo,
        pixels,
        reason: `Passes worst-case contrast (lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
      };
    }

    if (!passesLightest && !passesDarkest) {
      return {
        selector,
        category: 'violation',
        textColor: capture.textColor,
        halo,
        pixels,
        reason: `Fails best-case contrast (lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
      };
    }

    return {
      selector,
      category: 'incomplete',
      textColor: capture.textColor,
      halo,
      pixels,
      reason: `Split decision — passes one extreme but fails the other (lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
    };
  }
}
