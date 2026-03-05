/**
 * @module axe-bridge
 *
 * Post-processor for axe-core results that resolves "incomplete"
 * color-contrast warnings using visual pixel analysis and CSS
 * halo heuristics.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import { VisualContrastAnalyzer } from '@a11y-oracle/visual-engine';
import type { ContrastAnalysisResult } from '@a11y-oracle/visual-engine';
import type {
  AxeResults,
  AxeNode,
  ContrastResolutionOptions,
} from './types.js';
import { getContrastThresholds } from './wcag-thresholds.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from './resolver-pipeline.js';

/**
 * Determine the effective contrast threshold for an axe node.
 *
 * axe-core stores font metadata in `node.any[0].data` for the
 * color-contrast check. Large text (>= 18pt, or >= 14pt bold)
 * uses the lower 3.0 threshold.
 */
function getEffectiveThreshold(
  node: AxeNode,
  threshold: number,
  largeTextThreshold: number,
): number {
  try {
    const checkData = node.any?.[0]?.data as Record<string, unknown> | undefined;
    if (!checkData) return threshold;

    const fontSize = parseFloat(String(checkData['fontSize'] ?? '0'));
    const fontWeight = String(checkData['fontWeight'] ?? 'normal');
    const isBold =
      fontWeight === 'bold' ||
      fontWeight === 'bolder' ||
      parseInt(fontWeight, 10) >= 700;

    // WCAG large text: >= 18pt (24px) or >= 14pt (18.66px) if bold
    if (fontSize >= 24 || (fontSize >= 18.66 && isBold)) {
      return largeTextThreshold;
    }
  } catch {
    // If data parsing fails, use the stricter threshold
  }

  return threshold;
}

/**
 * Resolve incomplete color-contrast warnings from axe-core results
 * using visual pixel analysis and CSS halo heuristics.
 *
 * The function deep-clones the input results and returns a modified
 * copy where:
 * - Elements that pass worst-case contrast are promoted to `passes`
 * - Elements that fail best-case contrast are promoted to `violations`
 * - Ambiguous elements (split decision, dynamic content) remain in `incomplete`
 *
 * @param cdp - CDP session connected to the page being tested.
 * @param axeResults - Raw results from axe-core's `analyze()`.
 * @param options - Optional threshold overrides.
 * @returns Modified axe results with resolved contrast findings.
 *
 * @example
 * ```typescript
 * const axeResults = await axe.run(document);
 * const cleaned = await resolveIncompleteContrast(cdp, axeResults);
 * expect(cleaned.violations).toHaveLength(0);
 * ```
 */
export async function resolveIncompleteContrast(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: ContrastResolutionOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);

  // Derive thresholds: explicit values > wcagLevel > default (wcag22aa)
  const levelThresholds = getContrastThresholds(options?.wcagLevel);

  // Level A has no contrast requirement — skip resolution entirely
  if (!levelThresholds && !options?.threshold && !options?.largeTextThreshold) {
    return clone;
  }

  const threshold =
    options?.threshold ?? levelThresholds?.normalText ?? 4.5;
  const largeTextThreshold =
    options?.largeTextThreshold ?? levelThresholds?.largeText ?? 3.0;

  // Find the color-contrast rule in incomplete results
  const found = findIncompleteRule(clone, 'color-contrast');
  if (!found) return clone;

  const { index: ccIndex, rule: ccRule } = found;
  const analyzer = new VisualContrastAnalyzer(cdp);

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  // Analyze each incomplete node
  for (const node of ccRule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    const effectiveThreshold = getEffectiveThreshold(
      node,
      threshold,
      largeTextThreshold,
    );
    const result = await analyzer.analyzeElement(selector, effectiveThreshold);

    switch (result.category) {
      case 'pass':
        enrichNodeWithContrastData(node, result);
        passNodes.push(node);
        break;
      case 'violation':
        enrichNodeWithContrastData(node, result);
        violationNodes.push(node);
        break;
      case 'incomplete':
        enrichNodeWithContrastData(node, result);
        incompleteNodes.push(node);
        break;
    }
  }

  applyPromotions(clone, ccIndex, ccRule, {
    passNodes,
    violationNodes,
    incompleteNodes,
  });

  return clone;
}

/**
 * Enrich an axe node's check data with measured contrast information
 * from the visual analysis pipeline.
 *
 * Attaches the best-case measured contrast ratio, foreground color,
 * and analysis reason to `node.any[0].data` and `node.any[0].message`.
 * For violations, the best-case ratio is the highest contrast achieved
 * (still below threshold). For passes, it's the worst-case ratio
 * (still above threshold).
 */
function enrichNodeWithContrastData(
  node: AxeNode,
  result: ContrastAnalysisResult,
): void {
  if (!node.any[0]) return;

  const data = (node.any[0].data ?? {}) as Record<string, unknown>;

  if (result.pixels) {
    // For violations: best-case (max) is the highest contrast still failing.
    // For passes: worst-case (min) is the lowest contrast still passing.
    data.contrastRatio =
      result.category === 'violation'
        ? Math.max(result.pixels.crAgainstLightest, result.pixels.crAgainstDarkest)
        : Math.min(result.pixels.crAgainstLightest, result.pixels.crAgainstDarkest);
  }

  if (result.textColor) {
    data.fgColor = `rgb(${result.textColor.r}, ${result.textColor.g}, ${result.textColor.b})`;
  }

  node.any[0].data = data;
  node.any[0].message = result.reason;
}
