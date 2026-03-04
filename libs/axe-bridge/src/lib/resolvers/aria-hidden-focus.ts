/**
 * @module aria-hidden-focus
 *
 * Resolver for axe-core's `aria-hidden-focus` incomplete rule.
 * Detects focusable elements inside `aria-hidden="true"` containers
 * that are reachable via keyboard Tab navigation.
 *
 * Uses a single Tab traversal for ALL flagged nodes (not per-node)
 * to avoid O(N*M) Tab presses.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
import type { AxeResults, AxeNode, AriaHiddenFocusOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'aria-hidden-focus';

/** Default maximum number of Tab presses before stopping traversal. */
const DEFAULT_MAX_TABS = 100;

/**
 * Resolve incomplete `aria-hidden-focus` results.
 *
 * Focusable elements inside `aria-hidden="true"` containers should not
 * be reachable via keyboard. This resolver:
 * 1. Collects all flagged selectors into a lookup set
 * 2. Resets focus to `<body>`
 * 3. Tabs through the page up to `maxTabs` times
 * 4. At each step, checks if the focused element matches a flagged selector
 *
 * Reachable via Tab → **Violation**. Not reached → **Pass**.
 *
 * @param cdp - CDP session for keyboard dispatch and DOM queries.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional traversal limit.
 * @returns Modified results with resolved findings.
 */
export async function resolveAriaHiddenFocus(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: AriaHiddenFocusOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const maxTabs = options?.maxTabs ?? DEFAULT_MAX_TABS;
  const keyboard = new KeyboardEngine(cdp);

  // Build a map from selector to node for quick lookup
  const selectorToNode = new Map<string, AxeNode>();
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }
    selectorToNode.set(selector, node);
  }

  // Track which selectors were reached during traversal
  const reachedSelectors = new Set<string>();

  // Reset focus to body
  await cdp.send('Runtime.evaluate', {
    expression: 'document.activeElement?.blur(); document.body.focus(); void 0;',
    returnByValue: true,
  });

  // Tab through the page, checking at each step
  let previousSelector = '';
  for (let i = 0; i < maxTabs; i++) {
    await keyboard.press('Tab');

    // Get the currently focused element's unique selector
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // Build a selector that matches what axe-core generates
        // Try ID first
        if (el.id) return '#' + el.id;
        // Build path
        const path = [];
        let current = el;
        while (current && current !== document.body && current !== document.documentElement) {
          let seg = current.tagName.toLowerCase();
          if (current.id) {
            seg = '#' + current.id;
            path.unshift(seg);
            break;
          }
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(
              c => c.tagName === current.tagName
            );
            if (siblings.length > 1) {
              const idx = siblings.indexOf(current) + 1;
              seg += ':nth-child(' + idx + ')';
            }
          }
          path.unshift(seg);
          current = current.parentElement;
        }
        return path.join(' > ');
      })()`,
      returnByValue: true,
    }) as { result: { value: string | null } };

    const focusedSelector = result.result.value;

    // If we've looped back to body or same element, stop
    if (!focusedSelector) break;
    if (focusedSelector === previousSelector) break;
    previousSelector = focusedSelector;

    // Check if focused element matches any flagged selector
    for (const [selector] of selectorToNode) {
      if (reachedSelectors.has(selector)) continue;

      // Check if the currently focused element matches this selector
      const matchResult = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const el = document.activeElement;
          if (!el) return false;
          try {
            return el.matches(${JSON.stringify(selector)}) ||
                   el === document.querySelector(${JSON.stringify(selector)});
          } catch { return false; }
        })()`,
        returnByValue: true,
      }) as { result: { value: boolean } };

      if (matchResult.result.value) {
        reachedSelectors.add(selector);
      }
    }

    // Early exit if all selectors have been found
    if (reachedSelectors.size === selectorToNode.size) break;
  }

  // Classify nodes
  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];

  for (const [selector, node] of selectorToNode) {
    if (reachedSelectors.has(selector)) {
      // Element inside aria-hidden is reachable via Tab → Violation
      violationNodes.push(node);
    } else {
      // Element is not reachable via Tab → Pass
      passNodes.push(node);
    }
  }

  applyPromotions(clone, index, rule, {
    passNodes,
    violationNodes,
    incompleteNodes,
  });

  return clone;
}
