/**
 * @module visual-analyzer
 *
 * Coordinator class that runs the full visual contrast analysis pipeline:
 * halo heuristic -> dynamic content check -> pixel analysis -> Safe Assessment Matrix.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type {
  ContrastAnalysisResult,
  HaloResult,
  PixelDistributionOptions,
} from './types.js';
import { analyzeHalo } from './halo-detector.js';
import { extractPixelLuminance } from './pixel-analysis.js';
import {
  getElementStyles,
  captureElementBackground,
  isDynamicContent,
} from './screenshot.js';

/** Default WCAG AA contrast threshold for normal text. */
const DEFAULT_THRESHOLD = 4.5;

/**
 * Minimum fraction of pixels that must agree for a distribution-based
 * pass or violation decision. When the extremes disagree (split decision)
 * but >= 95% of pixels pass (or fail), the distribution overrides.
 */
const PASS_RATIO_THRESHOLD = 0.95;

/** Default supermajority pass ratio for split decisions. */
const DEFAULT_SUPERMAJORITY_PASS_RATIO = 0.75;

/**
 * Default best-case multiplier. If the best extreme CR exceeds
 * threshold × this value, auto-pass regardless of pixel distribution.
 */
const DEFAULT_BEST_CASE_MULTIPLIER = 2.0;

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
 *
 * @example
 * ```typescript
 * // With custom pixel distribution thresholds
 * const analyzer = new VisualContrastAnalyzer(cdpSession, {
 *   supermajorityPassRatio: 0.80,
 *   bestCaseMultiplier: 2.5,
 * });
 * ```
 */
export class VisualContrastAnalyzer {
  private readonly supermajorityPassRatio: number;
  private readonly bestCaseMultiplier: number;

  constructor(
    private cdp: CDPSessionLike,
    options?: PixelDistributionOptions,
  ) {
    this.supermajorityPassRatio =
      options?.supermajorityPassRatio ?? DEFAULT_SUPERMAJORITY_PASS_RATIO;
    this.bestCaseMultiplier =
      options?.bestCaseMultiplier ?? DEFAULT_BEST_CASE_MULTIPLIER;
  }

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

    // Step 5: Pixel-level luminance analysis (pass threshold for distribution)
    const pixels = extractPixelLuminance(capture.pngBuffer, capture.textColor, threshold);
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

    // Split decision — extremes disagree. Use pixel distribution to decide.
    if (pixels.passRatio != null) {
      // Overwhelming consensus (95%+): pass or violation
      if (pixels.passRatio >= PASS_RATIO_THRESHOLD) {
        return {
          selector,
          category: 'pass',
          textColor: capture.textColor,
          halo,
          pixels,
          reason: `Passes by pixel distribution (${(pixels.passRatio * 100).toFixed(1)}% of pixels pass, lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
        };
      }

      if (pixels.passRatio <= 1 - PASS_RATIO_THRESHOLD) {
        return {
          selector,
          category: 'violation',
          textColor: capture.textColor,
          halo,
          pixels,
          reason: `Fails by pixel distribution (${(pixels.passRatio * 100).toFixed(1)}% of pixels pass, lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
        };
      }

      // Supermajority: ≥75% of pixels pass — the dominant background
      // clearly provides adequate contrast despite edge artifacts.
      if (pixels.passRatio >= this.supermajorityPassRatio) {
        return {
          selector,
          category: 'pass',
          textColor: capture.textColor,
          halo,
          pixels,
          reason: `Passes by supermajority (${(pixels.passRatio * 100).toFixed(1)}% of pixels pass, lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
        };
      }
    }

    // Best-case override: if the most favorable extreme CR far exceeds the
    // WCAG threshold, the element almost certainly has adequate contrast.
    // Non-representative pixels from screenshot artifacts (adjacent elements,
    // decorative overlays, form styling) are the likely cause of the low
    // pass ratio.
    const bestCR = Math.max(pixels.crAgainstLightest, pixels.crAgainstDarkest);
    if (bestCR > threshold * this.bestCaseMultiplier) {
      return {
        selector,
        category: 'pass',
        textColor: capture.textColor,
        halo,
        pixels,
        reason: `Passes by best-case override (best: ${bestCR.toFixed(2)} > ${threshold.toFixed(1)}×${this.bestCaseMultiplier} = ${(threshold * this.bestCaseMultiplier).toFixed(1)}, ${pixels.passRatio != null ? `${(pixels.passRatio * 100).toFixed(1)}% pass, ` : ''}lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)})`,
      };
    }

    return {
      selector,
      category: 'incomplete',
      textColor: capture.textColor,
      halo,
      pixels,
      reason: `Split decision — passes one extreme but fails the other (lightest: ${pixels.crAgainstLightest.toFixed(2)}, darkest: ${pixels.crAgainstDarkest.toFixed(2)}${pixels.passRatio != null ? `, ${(pixels.passRatio * 100).toFixed(1)}% pass` : ''})`,
    };
  }
}
