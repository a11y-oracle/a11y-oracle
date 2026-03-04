/**
 * @module screenshot
 *
 * CDP-based element screenshot capture with text hiding. Extracts
 * computed styles and captures bounding-box screenshots of element
 * backgrounds after temporarily making text invisible.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import { parseColor } from '@a11y-oracle/focus-analyzer';
import type { RGBColor } from '@a11y-oracle/focus-analyzer';
import type { ElementComputedStyles } from './types.js';

/**
 * Decode a base64 string to Uint8Array.
 * Cross-platform: works in both Node.js (≥16) and browsers.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * JavaScript expression to extract computed styles relevant to
 * visual contrast analysis from a target element.
 *
 * @param selector - CSS selector string (will be JSON.stringify'd).
 */
function getStylesScript(selector: string): string {
  return `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const cs = window.getComputedStyle(el);
  return {
    color: cs.color || '',
    backgroundColor: cs.backgroundColor || '',
    textStrokeWidth: cs.webkitTextStrokeWidth || cs.getPropertyValue('-webkit-text-stroke-width') || '0px',
    textStrokeColor: cs.webkitTextStrokeColor || cs.getPropertyValue('-webkit-text-stroke-color') || '',
    textShadow: cs.textShadow || 'none',
    backgroundImage: cs.backgroundImage || 'none',
  };
})()
`;
}

/**
 * JavaScript expression to get the bounding rect and foreground color
 * of a target element, then hide its text content.
 *
 * Returns the bounding rect and text color before hiding.
 */
function getCaptureInfoAndHideScript(selector: string): string {
  return `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const cs = window.getComputedStyle(el);
  const color = cs.color || '';
  const rect = el.getBoundingClientRect();
  const info = {
    color,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
  // Hide text content to expose background
  el.style.setProperty('color', 'transparent', 'important');
  el.style.setProperty('text-shadow', 'none', 'important');
  el.style.setProperty('caret-color', 'transparent', 'important');
  return info;
})()
`;
}

/**
 * JavaScript expression to restore text visibility on a target element.
 */
function restoreTextScript(selector: string): string {
  return `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  el.style.removeProperty('color');
  el.style.removeProperty('text-shadow');
  el.style.removeProperty('caret-color');
  return true;
})()
`;
}

/**
 * JavaScript expression to detect dynamic/temporal content that
 * prevents reliable pixel analysis.
 */
function isDynamicContentScript(selector: string): string {
  return `
(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  // Check if element is or is inside a video/canvas
  if (el.tagName === 'VIDEO' || el.tagName === 'CANVAS') return true;
  if (el.closest('video, canvas')) return true;
  // Check for semi-transparent element or blend modes
  const cs = window.getComputedStyle(el);
  if (parseFloat(cs.opacity) < 1) return true;
  if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return true;
  return false;
})()
`;
}

/**
 * Extract computed styles from an element for halo analysis.
 *
 * @param cdp - CDP session.
 * @param selector - CSS selector targeting the element.
 * @returns Computed styles, or null if element not found.
 */
export async function getElementStyles(
  cdp: CDPSessionLike,
  selector: string,
): Promise<ElementComputedStyles | null> {
  const result = (await cdp.send('Runtime.evaluate', {
    expression: getStylesScript(selector),
    returnByValue: true,
  })) as { result: { value: ElementComputedStyles | null } };

  return result.result.value;
}

/**
 * Check if an element contains dynamic/temporal content that
 * prevents reliable pixel analysis (video, canvas, opacity < 1, blend modes).
 *
 * @param cdp - CDP session.
 * @param selector - CSS selector targeting the element.
 * @returns true if the element has dynamic content.
 */
export async function isDynamicContent(
  cdp: CDPSessionLike,
  selector: string,
): Promise<boolean> {
  const result = (await cdp.send('Runtime.evaluate', {
    expression: isDynamicContentScript(selector),
    returnByValue: true,
  })) as { result: { value: boolean } };

  return result.result.value;
}

/**
 * Capture a bounding-box screenshot of an element's background
 * after temporarily hiding its text content.
 *
 * The text is hidden via CSS injection (`color: transparent`) and
 * restored in a `finally` block to ensure cleanup even on errors.
 *
 * @param cdp - CDP session.
 * @param selector - CSS selector targeting the element.
 * @returns PNG buffer of the background and the parsed text color,
 *          or null if the element was not found.
 */
export async function captureElementBackground(
  cdp: CDPSessionLike,
  selector: string,
): Promise<{ pngBuffer: Uint8Array; textColor: RGBColor | null } | null> {
  // Get info and hide text in one atomic operation
  const infoResult = (await cdp.send('Runtime.evaluate', {
    expression: getCaptureInfoAndHideScript(selector),
    returnByValue: true,
  })) as {
    result: {
      value: {
        color: string;
        x: number;
        y: number;
        width: number;
        height: number;
      } | null;
    };
  };

  const info = infoResult.result.value;
  if (!info || info.width <= 0 || info.height <= 0) return null;

  try {
    // Capture screenshot of the background-only region
    const screenshotResult = (await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: info.x,
        y: info.y,
        width: info.width,
        height: info.height,
        scale: 1,
      },
    })) as { data: string };

    const pngBuffer = base64ToUint8Array(screenshotResult.data);
    const textColor = parseColor(info.color);

    return { pngBuffer, textColor };
  } finally {
    // Always restore text visibility
    await cdp.send('Runtime.evaluate', {
      expression: restoreTextScript(selector),
      returnByValue: true,
    });
  }
}
