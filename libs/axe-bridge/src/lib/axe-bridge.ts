/**
 * @module axe-bridge
 *
 * Post-processor for axe-core results that resolves "incomplete"
 * color-contrast warnings using visual pixel analysis and CSS
 * halo heuristics.
 */

import type { CDPSessionLike } from '@a11y-oracle/keyboard-engine';
import { VisualContrastAnalyzer } from '@a11y-oracle/visual-engine';
import type {
  AxeResults,
  AxeRule,
  AxeNode,
  ContrastResolutionOptions,
} from './types.js';

/** Default WCAG AA thresholds. */
const DEFAULT_THRESHOLD = 4.5;
const DEFAULT_LARGE_TEXT_THRESHOLD = 3.0;

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
 * Extract the innermost CSS selector from an axe node's target.
 *
 * axe-core represents selectors as arrays where shadow DOM targets
 * have multiple entries. We use the last (innermost) selector.
 */
function getSelector(node: AxeNode): string {
  return node.target[node.target.length - 1] ?? '';
}

/**
 * Deep-clone an AxeResults object to avoid mutating the original.
 */
function cloneResults(results: AxeResults): AxeResults {
  return JSON.parse(JSON.stringify(results));
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
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const largeTextThreshold =
    options?.largeTextThreshold ?? DEFAULT_LARGE_TEXT_THRESHOLD;

  // Find the color-contrast rule in incomplete results
  const ccIndex = clone.incomplete.findIndex(
    (r) => r.id === 'color-contrast',
  );
  if (ccIndex === -1) return clone;

  const ccRule = clone.incomplete[ccIndex];
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
        passNodes.push(node);
        break;
      case 'violation':
        violationNodes.push(node);
        break;
      case 'incomplete':
        incompleteNodes.push(node);
        break;
    }
  }

  // Promote violations
  if (violationNodes.length > 0) {
    const existing = clone.violations.find((r) => r.id === 'color-contrast');
    if (existing) {
      existing.nodes.push(...violationNodes);
    } else {
      clone.violations.push({
        ...ruleShell(ccRule),
        nodes: violationNodes,
      });
    }
  }

  // Promote passes
  if (passNodes.length > 0) {
    const existing = clone.passes.find((r) => r.id === 'color-contrast');
    if (existing) {
      existing.nodes.push(...passNodes);
    } else {
      clone.passes.push({
        ...ruleShell(ccRule),
        nodes: passNodes,
      });
    }
  }

  // Update or remove the incomplete entry
  if (incompleteNodes.length > 0) {
    ccRule.nodes = incompleteNodes;
  } else {
    clone.incomplete.splice(ccIndex, 1);
  }

  return clone;
}

/**
 * Create a rule shell (all metadata, no nodes) from an existing rule.
 */
function ruleShell(rule: AxeRule): AxeRule {
  return {
    id: rule.id,
    impact: rule.impact,
    tags: [...rule.tags],
    description: rule.description,
    help: rule.help,
    helpUrl: rule.helpUrl,
    nodes: [],
  };
}
