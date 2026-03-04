/**
 * @module scrollable-region-focusable
 *
 * Resolver for axe-core's `scrollable-region-focusable` incomplete rule
 * (WCAG 2.1.1 Keyboard). Verifies that scrollable containers are
 * keyboard-accessible, either via tabindex or focusable children.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, ScrollableRegionOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'scrollable-region-focusable';

/** CSS selector for focusable elements within a container. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Resolve incomplete `scrollable-region-focusable` results.
 *
 * For each flagged scrollable container:
 * 1. Check if actually scrollable (scrollHeight > clientHeight).
 *    If not → **Pass** (false positive).
 * 2. Check for `tabindex >= 0` on container → **Pass**.
 * 3. Check for visible focusable children. If none → **Violation**.
 * 4. Focus last focusable child, check if scroll position changed → **Pass**.
 *
 * @param cdp - CDP session for querying DOM properties.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional configuration.
 * @returns Modified results with resolved findings.
 */
export async function resolveScrollableRegionFocusable(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: ScrollableRegionOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const maxChildren = options?.maxChildren ?? 50;

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const container = document.querySelector(${JSON.stringify(selector)});
        if (!container) return null;

        // Check 1: Is it actually scrollable?
        const isScrollableV = container.scrollHeight > container.clientHeight;
        const isScrollableH = container.scrollWidth > container.clientWidth;
        if (!isScrollableV && !isScrollableH) {
          return { category: 'pass', reason: 'not-scrollable' };
        }

        // Check 2: Does the container itself have tabindex?
        if (container.tabIndex >= 0) {
          return { category: 'pass', reason: 'has-tabindex' };
        }

        // Check 3: Find visible focusable children
        const focusable = container.querySelectorAll(${JSON.stringify(FOCUSABLE_SELECTOR)});
        const visible = [];
        for (let i = 0; i < Math.min(focusable.length, ${maxChildren}); i++) {
          const el = focusable[i];
          const cs = window.getComputedStyle(el);
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null) {
            visible.push(el);
          }
        }

        if (visible.length === 0) {
          return { category: 'violation', reason: 'no-focusable-children' };
        }

        // Check 4: Focus last child and see if container scrolls
        const origScrollTop = container.scrollTop;
        const origScrollLeft = container.scrollLeft;
        const lastChild = visible[visible.length - 1];
        lastChild.focus();
        const scrolled =
          container.scrollTop !== origScrollTop ||
          container.scrollLeft !== origScrollLeft;

        // Restore state
        container.scrollTop = origScrollTop;
        container.scrollLeft = origScrollLeft;
        lastChild.blur();

        if (scrolled) {
          return { category: 'pass', reason: 'scroll-reached' };
        }

        // Last child was already visible without scrolling — check
        // if there's content beyond what's reachable by focusable children
        const lastRect = lastChild.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const contentBottom = container.scrollHeight;
        const lastChildBottom = lastRect.bottom - containerRect.top + container.scrollTop;

        if (lastChildBottom >= contentBottom - 5) {
          // Focusable children reach the bottom of content
          return { category: 'pass', reason: 'children-cover-content' };
        }

        // There's content below the last focusable child that is unreachable
        return { category: 'violation', reason: 'unreachable-content' };
      })()`,
      returnByValue: true,
    }) as { result: { value: { category: string; reason: string } | null } };

    const data = result.result.value;
    if (!data) {
      incompleteNodes.push(node);
      continue;
    }

    switch (data.category) {
      case 'pass':
        passNodes.push(node);
        break;
      case 'violation':
        violationNodes.push(node);
        break;
      default:
        incompleteNodes.push(node);
    }
  }

  applyPromotions(clone, index, rule, {
    passNodes,
    violationNodes,
    incompleteNodes,
  });

  return clone;
}
