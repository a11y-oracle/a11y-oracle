/**
 * @module link-in-text-block
 *
 * Resolver for axe-core's `link-in-text-block` incomplete rule
 * (WCAG 1.4.1 Use of Color). Checks the DEFAULT/resting state of
 * inline links for non-color visual differentiation.
 *
 * IMPORTANT: Hover/focus states are NOT checked. If a link only
 * shows differentiation on hover or focus, that is a **Violation**.
 * The link must be visually distinct in its resting state.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import { parseColor, contrastRatio } from '@a11y-oracle/focus-analyzer';
import type { AxeResults, AxeNode, LinkInTextBlockOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'link-in-text-block';

/** Default minimum contrast ratio between link color and surrounding text. */
const DEFAULT_LINK_TEXT_CONTRAST = 3.0;

/**
 * Resolve incomplete `link-in-text-block` results.
 *
 * Checks the **default/resting state** of inline links for:
 * 1. Non-color visual indicators (underline, border-bottom, font-weight diff)
 * 2. Sufficient color contrast (≥ 3:1) between link and surrounding text
 *
 * If neither is present → Violation (indistinguishable from surrounding text).
 *
 * @param cdp - CDP session for querying computed styles.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional threshold override.
 * @returns Modified results with resolved findings.
 */
export async function resolveLinkInTextBlock(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: LinkInTextBlockOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const threshold = options?.linkTextContrastThreshold ?? DEFAULT_LINK_TEXT_CONTRAST;

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    // Query computed styles for link and its parent in DEFAULT state
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const link = document.querySelector(${JSON.stringify(selector)});
        if (!link) return null;
        const parent = link.parentElement;
        if (!parent) return null;
        const linkCS = window.getComputedStyle(link);
        const parentCS = window.getComputedStyle(parent);
        return {
          link: {
            textDecorationLine: linkCS.textDecorationLine,
            borderBottomWidth: linkCS.borderBottomWidth,
            borderBottomStyle: linkCS.borderBottomStyle,
            fontWeight: linkCS.fontWeight,
            color: linkCS.color,
          },
          parent: {
            fontWeight: parentCS.fontWeight,
            color: parentCS.color,
          },
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: LinkStyles | null } };

    const data = result.result.value;
    if (!data) {
      incompleteNodes.push(node);
      continue;
    }

    // Check 1: Non-color visual indicator in default state
    if (hasNonColorIndicator(data)) {
      passNodes.push(node);
      continue;
    }

    // Check 2: Sufficient contrast between link color and surrounding text
    const linkColor = parseColor(data.link.color);
    const parentColor = parseColor(data.parent.color);

    if (linkColor && parentColor) {
      const cr = contrastRatio(linkColor, parentColor);
      if (cr >= threshold) {
        passNodes.push(node);
        continue;
      }
    }

    // No non-color indicator and insufficient contrast → Violation
    violationNodes.push(node);
  }

  applyPromotions(clone, index, rule, {
    passNodes,
    violationNodes,
    incompleteNodes,
  });

  return clone;
}

/** Computed styles shape returned from the CDP evaluation. */
interface LinkStyles {
  link: {
    textDecorationLine: string;
    borderBottomWidth: string;
    borderBottomStyle: string;
    fontWeight: string;
    color: string;
  };
  parent: {
    fontWeight: string;
    color: string;
  };
}

/**
 * Check if the link has a non-color visual indicator in its default state.
 */
function hasNonColorIndicator(data: LinkStyles): boolean {
  // Underline present
  if (data.link.textDecorationLine.includes('underline')) {
    return true;
  }

  // Border-bottom present (visible border)
  const borderWidth = parseFloat(data.link.borderBottomWidth);
  if (
    !isNaN(borderWidth) &&
    borderWidth > 0 &&
    data.link.borderBottomStyle !== 'none'
  ) {
    return true;
  }

  // Font-weight difference between link and parent
  const linkWeight = parseFontWeight(data.link.fontWeight);
  const parentWeight = parseFontWeight(data.parent.fontWeight);
  if (linkWeight !== parentWeight) {
    return true;
  }

  return false;
}

/**
 * Parse CSS font-weight to a numeric value.
 */
function parseFontWeight(weight: string): number {
  switch (weight) {
    case 'normal':
      return 400;
    case 'bold':
      return 700;
    case 'lighter':
      return 100;
    case 'bolder':
      return 900;
    default:
      return parseInt(weight, 10) || 400;
  }
}
