/**
 * @module content-on-hover
 *
 * Resolver for axe-core's `content-on-hover` incomplete rule
 * (WCAG 1.4.13 Content on Hover or Focus). Verifies that
 * hover-triggered content is both hoverable and dismissible.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
import type { AxeResults, AxeNode, ContentOnHoverOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'content-on-hover';

/** Default delay waiting for content to appear after hover. */
const DEFAULT_HOVER_DELAY = 300;

/** Default delay waiting for content to disappear after dismiss. */
const DEFAULT_DISMISS_DELAY = 200;

/**
 * Resolve incomplete `content-on-hover` results.
 *
 * For each flagged trigger element:
 * 1. Set up a MutationObserver to detect new content
 * 2. Hover the trigger element via `Input.dispatchMouseEvent`
 * 3. Wait for content to appear
 * 4. **Hoverable test:** Move mouse to new content; if it disappears → Violation
 * 5. **Dismissible test:** Press Escape; if content persists → Violation
 * 6. Both pass → **Pass**
 *
 * @param cdp - CDP session for mouse/keyboard dispatch and DOM queries.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional delay configuration.
 * @returns Modified results with resolved findings.
 */
export async function resolveContentOnHover(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: ContentOnHoverOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const hoverDelay = options?.hoverDelay ?? DEFAULT_HOVER_DELAY;
  const dismissDelay = options?.dismissDelay ?? DEFAULT_DISMISS_DELAY;
  const keyboard = new KeyboardEngine(cdp);

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    // Set up MutationObserver and get trigger element position
    const setupResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const trigger = document.querySelector(${JSON.stringify(selector)});
        if (!trigger) return null;
        const rect = trigger.getBoundingClientRect();

        // Set up observer to detect newly added elements
        window.__a11yHoverNewContent = [];
        window.__a11yHoverObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const added of mutation.addedNodes) {
              if (added.nodeType === 1) {
                window.__a11yHoverNewContent.push(added);
              }
            }
          }
        });
        window.__a11yHoverObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Record initial visibility state of potential tooltip/popup elements
        // (some implementations toggle visibility rather than adding nodes)
        const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, [data-tooltip]');
        window.__a11yHoverInitialHidden = new Set();
        tooltips.forEach(t => {
          const cs = window.getComputedStyle(t);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
            window.__a11yHoverInitialHidden.add(t);
          }
        });

        return {
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: { x: number; y: number } | null } };

    if (!setupResult.result.value) {
      incompleteNodes.push(node);
      continue;
    }

    const { x: triggerX, y: triggerY } = setupResult.result.value;

    // Hover the trigger element
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: triggerX,
      y: triggerY,
    });

    // Wait for content to appear
    await delay(hoverDelay);

    // Check for new content
    const contentResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        // Check for newly added nodes
        let newContent = window.__a11yHoverNewContent || [];

        // Also check for elements that became visible
        const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, [data-tooltip]');
        tooltips.forEach(t => {
          if (window.__a11yHoverInitialHidden && window.__a11yHoverInitialHidden.has(t)) {
            const cs = window.getComputedStyle(t);
            if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0') {
              newContent.push(t);
            }
          }
        });

        if (newContent.length === 0) return null;

        // Get position of the first new content element
        const content = newContent[0];
        const rect = content.getBoundingClientRect();
        return {
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          visible: rect.width > 0 && rect.height > 0,
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: { x: number; y: number; visible: boolean } | null } };

    if (!contentResult.result.value || !contentResult.result.value.visible) {
      // No hover content appeared — likely a false positive from axe-core
      // or content appeared too slowly. Leave as incomplete.
      await cleanup(cdp);
      incompleteNodes.push(node);
      continue;
    }

    const { x: contentX, y: contentY } = contentResult.result.value;

    // Test 1: HOVERABLE — Move mouse to the new content
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: contentX,
      y: contentY,
    });

    await delay(dismissDelay);

    // Check if content is still visible
    const hoverableResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const newContent = window.__a11yHoverNewContent || [];
        if (newContent.length === 0) return false;
        const content = newContent[0];
        // Check if it's still in the DOM and visible
        if (!document.contains(content)) return false;
        const cs = window.getComputedStyle(content);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
        const rect = content.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })()`,
      returnByValue: true,
    }) as { result: { value: boolean } };

    const isHoverable = hoverableResult.result.value;

    if (!isHoverable) {
      // Content disappears when mouse moves to it → Violation
      await cleanup(cdp);
      violationNodes.push(node);
      continue;
    }

    // Move mouse back to trigger to re-show content for dismiss test
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: triggerX,
      y: triggerY,
    });

    await delay(hoverDelay);

    // Test 2: DISMISSIBLE — Press Escape key
    await keyboard.press('Escape');
    await delay(dismissDelay);

    // Check if content was dismissed
    const dismissedResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const newContent = window.__a11yHoverNewContent || [];
        if (newContent.length === 0) return true;
        const content = newContent[0];
        if (!document.contains(content)) return true;
        const cs = window.getComputedStyle(content);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
        const rect = content.getBoundingClientRect();
        return rect.width === 0 || rect.height === 0;
      })()`,
      returnByValue: true,
    }) as { result: { value: boolean } };

    const isDismissible = dismissedResult.result.value;

    await cleanup(cdp);

    if (!isDismissible) {
      // Content cannot be dismissed with Escape → Violation
      violationNodes.push(node);
    } else {
      // Content is both hoverable and dismissible → Pass
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

/**
 * Clean up the MutationObserver and temporary state.
 */
async function cleanup(cdp: CDPSessionLike): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__a11yHoverObserver) {
        window.__a11yHoverObserver.disconnect();
        delete window.__a11yHoverObserver;
      }
      delete window.__a11yHoverNewContent;
      delete window.__a11yHoverInitialHidden;
    })()`,
    returnByValue: true,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
