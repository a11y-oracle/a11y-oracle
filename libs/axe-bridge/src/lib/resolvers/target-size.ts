/**
 * @module target-size
 *
 * Resolver for axe-core's `target-size` incomplete rule
 * (WCAG 2.5.8 Target Size Minimum). Verifies that interactive
 * elements have at least 24×24 CSS pixels or sufficient spacing.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, TargetSizeOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'target-size';

/** Default minimum target dimension in CSS pixels. */
const DEFAULT_MIN_SIZE = 24;

/** CSS selector for interactive elements. */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Resolve incomplete `target-size` results.
 *
 * Checks each flagged element's rendered bounding box:
 * 1. If width ≥ 24 AND height ≥ 24 → **Pass**
 * 2. If undersized, calculates center-to-center distance to
 *    nearest interactive neighbor. If distance ≥ 24px → **Pass**
 * 3. Otherwise → **Violation**
 *
 * @param cdp - CDP session for querying bounding boxes.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional size threshold override.
 * @returns Modified results with resolved findings.
 */
export async function resolveTargetSize(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: TargetSizeOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const minSize = options?.minSize ?? DEFAULT_MIN_SIZE;

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    // Get bounding box of target element and all interactive neighbors
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const target = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
        // If already large enough, no need to check neighbors
        if (rect.width >= ${minSize} && rect.height >= ${minSize}) {
          return { target, meetsMinSize: true, minDistance: null };
        }
        // Find nearest interactive neighbor
        const all = document.querySelectorAll(${JSON.stringify(INTERACTIVE_SELECTOR)});
        let minDist = Infinity;
        for (const other of all) {
          if (other === el) continue;
          const oRect = other.getBoundingClientRect();
          if (oRect.width === 0 || oRect.height === 0) continue;
          const cx = oRect.x + oRect.width / 2;
          const cy = oRect.y + oRect.height / 2;
          const dist = Math.sqrt(
            Math.pow(target.x - cx, 2) + Math.pow(target.y - cy, 2)
          );
          minDist = Math.min(minDist, dist);
        }
        return {
          target,
          meetsMinSize: false,
          minDistance: minDist === Infinity ? null : minDist,
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: TargetSizeResult | null } };

    const data = result.result.value;
    if (!data) {
      incompleteNodes.push(node);
      continue;
    }

    if (data.meetsMinSize) {
      passNodes.push(node);
    } else if (data.minDistance !== null && data.minDistance >= minSize) {
      // Undersized but has sufficient spacing
      passNodes.push(node);
    } else if (data.minDistance === null) {
      // Undersized but no neighbors found (only interactive element)
      // This is technically a pass for the spacing exemption,
      // but the element itself is still undersized → Violation
      violationNodes.push(node);
    } else {
      // Undersized and too close to a neighbor
      violationNodes.push(node);
    }
  }

  applyPromotions(clone, index, rule, {
    passNodes,
    violationNodes,
    incompleteNodes,
  });

  return clone;
}

interface TargetSizeResult {
  target: { x: number; y: number; width: number; height: number };
  meetsMinSize: boolean;
  minDistance: number | null;
}
