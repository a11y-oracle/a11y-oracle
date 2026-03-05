/**
 * @module focus-indicator
 *
 * Resolver for axe-core's incomplete focus-indicator-related rules
 * (WCAG 2.4.7 Focus Visible). Takes before/after screenshots of
 * elements in resting vs focused states and pixel-diffs them.
 *
 * If the screenshots are identical → no visible focus indicator → Violation.
 * If they differ → focus indicator is present → Pass.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import { decodePng } from '@a11y-oracle/visual-engine';
import type { AxeResults, AxeNode, FocusIndicatorOptions } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'focus-indicator';

/** Default delay after focus for CSS transitions to settle. */
const DEFAULT_FOCUS_SETTLE_DELAY = 100;

/**
 * Minimum percentage of pixels that must differ to count as a
 * visible focus indicator. Accounts for anti-aliasing noise.
 */
const DEFAULT_DIFF_THRESHOLD = 0.1;

/**
 * Resolve incomplete focus-indicator results.
 *
 * For each flagged element:
 * 1. Capture a clipped screenshot of the element in resting state
 * 2. Focus the element via `element.focus()`
 * 3. Wait for CSS transitions to settle
 * 4. Capture a second screenshot
 * 5. Pixel-diff the two images
 *
 * Different → **Pass** (focus indicator visible).
 * Identical → **Violation** (no visible focus change).
 *
 * @param cdp - CDP session for screenshots and focus dispatch.
 * @param axeResults - Raw axe-core results.
 * @param options - Optional delay and threshold configuration.
 * @returns Modified results with resolved findings.
 */
export async function resolveFocusIndicator(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options?: FocusIndicatorOptions,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;
  const settleDelay = options?.focusSettleDelay ?? DEFAULT_FOCUS_SETTLE_DELAY;
  const diffThreshold = options?.diffThreshold ?? DEFAULT_DIFF_THRESHOLD;

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  // Ensure focus indicators render even when the page isn't the active
  // window (headless browsers, Cypress AUT iframe, DevTools open, etc.).
  try {
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  } catch {
    // Older Chrome versions may not support this — continue without it.
  }

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    // Ensure element is not focused (reset state)
    await cdp.send('Runtime.evaluate', {
      expression: 'document.activeElement?.blur(); void 0;',
      returnByValue: true,
    });

    // Wait for any transitions to settle after blur
    await delay(settleDelay);

    // Get element bounding box for clipped screenshot
    const boundsResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        // Scroll element into viewport so Page.captureScreenshot can capture it.
        // Without this, off-screen elements produce white screenshots.
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
        const rect = el.getBoundingClientRect();
        // Expand clip region slightly to capture outline/box-shadow
        const pad = 4;
        return {
          x: Math.max(0, Math.round(rect.x - pad)),
          y: Math.max(0, Math.round(rect.y - pad)),
          width: Math.round(rect.width + pad * 2),
          height: Math.round(rect.height + pad * 2),
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: ClipRect | null } };

    const bounds = boundsResult.result.value;
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      incompleteNodes.push(node);
      continue;
    }

    // Capture resting-state screenshot
    const beforeShot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        scale: 1,
      },
    }) as { data: string };

    // Focus the element
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) el.focus();
      })()`,
      returnByValue: true,
    });

    // Wait for CSS transitions to settle
    await delay(settleDelay);

    // Capture focused-state screenshot
    const afterShot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        scale: 1,
      },
    }) as { data: string };

    // Compare screenshots
    const diffPercent = pixelDiffPercent(beforeShot.data, afterShot.data);

    if (diffPercent > diffThreshold) {
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

/** Bounding rectangle for screenshot clipping. */
interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the percentage of pixels that differ between two PNG images
 * encoded as base64 strings.
 *
 * @param base64Before - Base64-encoded PNG of the resting state.
 * @param base64After - Base64-encoded PNG of the focused state.
 * @returns Percentage (0-100) of pixels that differ.
 */
function pixelDiffPercent(base64Before: string, base64After: string): number {
  const beforeBuf = base64ToUint8Array(base64Before);
  const afterBuf = base64ToUint8Array(base64After);

  const before = decodePng(beforeBuf);
  const after = decodePng(afterBuf);

  // If dimensions don't match, treat as entirely different
  if (before.width !== after.width || before.height !== after.height) {
    return 100;
  }

  const totalPixels = before.width * before.height;
  if (totalPixels === 0) return 0;

  let diffCount = 0;
  // Pixel threshold: RGB channels must differ by more than this
  const channelThreshold = 10;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const dr = Math.abs(before.data[offset] - after.data[offset]);
    const dg = Math.abs(before.data[offset + 1] - after.data[offset + 1]);
    const db = Math.abs(before.data[offset + 2] - after.data[offset + 2]);

    if (dr > channelThreshold || dg > channelThreshold || db > channelThreshold) {
      diffCount++;
    }
  }

  return (diffCount / totalPixels) * 100;
}

/**
 * Convert a base64-encoded string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
