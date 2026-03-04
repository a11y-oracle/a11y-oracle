/**
 * @module skip-link
 *
 * Resolver for axe-core's `skip-link` incomplete rule
 * (WCAG 2.4.1 Bypass Blocks). Verifies that skip links become
 * visible when they receive keyboard focus.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode, SkipLinkOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'skip-link';

/** Default delay after focus for CSS transitions to settle. */
const DEFAULT_FOCUS_SETTLE_DELAY = 100;

/**
 * Resolve incomplete `skip-link` results.
 *
 * Skip links are typically visually hidden until focused. This resolver:
 * 1. Resets focus to the document body
 * 2. Dispatches a native Tab keystroke to focus the skip link
 * 3. Checks if the element becomes visible (bounding box, opacity, clip, position)
 *
 * Visible on focus → **Pass**. Hidden on focus → **Violation**.
 *
 * @param cdp - CDP session for keyboard dispatch and style queries.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional delay configuration.
 * @returns Modified results with resolved findings.
 */
export async function resolveSkipLink(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: SkipLinkOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const settleDelay = options?.focusSettleDelay ?? DEFAULT_FOCUS_SETTLE_DELAY;

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    // Reset focus to body
    await cdp.send('Runtime.evaluate', {
      expression: 'document.activeElement?.blur(); void 0;',
      returnByValue: true,
    });

    // Focus the skip link via element.focus() for reliability
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) el.focus();
      })()`,
      returnByValue: true,
    });

    // Wait for CSS transitions to settle
    await delay(settleDelay);

    // Check visibility
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const isFocused = document.activeElement === el;
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          isFocused,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          opacity: cs.opacity,
          visibility: cs.visibility,
          display: cs.display,
          clip: cs.clip,
          clipPath: cs.clipPath,
          position: cs.position,
          overflow: cs.overflow,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: SkipLinkVisibility | null } };

    const data = result.result.value;
    if (!data) {
      incompleteNodes.push(node);
      continue;
    }

    if (isVisible(data)) {
      passNodes.push(node);
    } else {
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

interface SkipLinkVisibility {
  isFocused: boolean;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  opacity: string;
  visibility: string;
  display: string;
  clip: string;
  clipPath: string;
  position: string;
  overflow: string;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Determine if a skip link is visible on screen after receiving focus.
 */
function isVisible(data: SkipLinkVisibility): boolean {
  // Must have non-zero dimensions
  if (data.width <= 0 || data.height <= 0) return false;

  // Must not be display: none or visibility: hidden
  if (data.display === 'none') return false;
  if (data.visibility === 'hidden') return false;

  // Must not be fully transparent
  if (data.opacity === '0') return false;

  // Must not be clipped to zero size
  const clipZero = /rect\(\s*0(px)?\s*,?\s*0(px)?\s*,?\s*0(px)?\s*,?\s*0(px)?\s*\)/;
  if (clipZero.test(data.clip)) return false;
  if (data.clipPath === 'inset(100%)') return false;

  // Must be within viewport (not positioned off-screen)
  if (data.right <= 0) return false;
  if (data.bottom <= 0) return false;
  if (data.left >= data.viewportWidth) return false;
  if (data.top >= data.viewportHeight) return false;

  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
