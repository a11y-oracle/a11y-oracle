/**
 * @module focus-analyzer
 *
 * Analyzes visual focus indicators, extracts DOM tab order, and
 * detects keyboard traps via CDP `Runtime.evaluate`.
 *
 * @example
 * ```typescript
 * import { FocusAnalyzer } from '@a11y-oracle/focus-analyzer';
 *
 * const analyzer = new FocusAnalyzer(cdpSession);
 * const indicator = await analyzer.getFocusIndicator();
 * console.log(indicator.isVisible, indicator.contrastRatio);
 * ```
 */

import type { CDPSessionLike } from '@a11y-oracle/keyboard-engine';
import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
import type {
  FocusIndicator,
  TabOrderEntry,
  TraversalResult,
} from './types.js';
import { parseColor } from './color-parser.js';
import { contrastRatio, meetsAA } from './contrast.js';

/**
 * JavaScript expression to extract computed focus styles from
 * `document.activeElement`.
 */
const GET_FOCUS_STYLES_JS = `
(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return null;
  }
  const cs = window.getComputedStyle(el);
  return {
    outline: cs.outline || '',
    outlineColor: cs.outlineColor || '',
    outlineWidth: cs.outlineWidth || '',
    outlineOffset: cs.outlineOffset || '',
    boxShadow: cs.boxShadow || '',
    borderColor: cs.borderColor || '',
    backgroundColor: cs.backgroundColor || '',
  };
})()
`;

/**
 * JavaScript expression to extract all tabbable elements in DOM order.
 */
const GET_TAB_ORDER_JS = `
(() => {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]',
  ].join(', ');
  const elements = Array.from(document.querySelectorAll(selector));
  return elements
    .filter(el => {
      if (el.tabIndex < 0) return false;
      if (el.offsetParent === null && el.tagName !== 'BODY') return false;
      const cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (el.closest('[inert]')) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.tabIndex === 0 && b.tabIndex === 0) return 0;
      if (a.tabIndex === 0) return 1;
      if (b.tabIndex === 0) return -1;
      return a.tabIndex - b.tabIndex;
    })
    .map((el, i) => {
      const rect = el.getBoundingClientRect();
      return {
        index: i,
        tag: el.tagName,
        id: el.id || '',
        textContent: (el.textContent || '').trim().substring(0, 200),
        tabIndex: el.tabIndex,
        role: el.getAttribute('role') || '',
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
})()
`;

/**
 * Analyzes focus indicators, tab order, and keyboard traps.
 *
 * Uses CDP `Runtime.evaluate` to inspect DOM state and
 * {@link KeyboardEngine} for dispatching Tab keys during
 * trap detection.
 */
export class FocusAnalyzer {
  private keyboard: KeyboardEngine;

  /**
   * @param cdp - CDP session for sending protocol commands.
   */
  constructor(private cdp: CDPSessionLike) {
    this.keyboard = new KeyboardEngine(cdp);
  }

  /**
   * Analyze the visual focus indicator of the currently focused element.
   *
   * Extracts computed CSS properties (`outline`, `box-shadow`, `border`,
   * `background-color`) and calculates the contrast ratio of the focus
   * indicator against the background.
   *
   * @returns Focus indicator analysis, or a default "not visible"
   *          indicator if no element has focus.
   */
  async getFocusIndicator(): Promise<FocusIndicator> {
    const result = (await this.cdp.send('Runtime.evaluate', {
      expression: GET_FOCUS_STYLES_JS,
      returnByValue: true,
    })) as { result: { value: Record<string, string> | null } };

    const styles = result.result.value;

    if (!styles) {
      return this.createEmptyIndicator();
    }

    const outlineWidth = styles.outlineWidth || '0px';
    const hasOutline =
      outlineWidth !== '0px' &&
      outlineWidth !== '0' &&
      styles.outlineColor !== 'transparent';
    const hasBoxShadow =
      styles.boxShadow !== 'none' && styles.boxShadow !== '';

    const isVisible = hasOutline || hasBoxShadow;

    // Calculate contrast ratio between focus indicator and background
    let ratio: number | null = null;
    if (isVisible) {
      const indicatorColor = hasOutline
        ? parseColor(styles.outlineColor)
        : this.extractBoxShadowColor(styles.boxShadow);
      const bgColor = parseColor(styles.backgroundColor);

      if (indicatorColor && bgColor) {
        ratio = contrastRatio(indicatorColor, bgColor);
      }
    }

    return {
      isVisible,
      outline: styles.outline || '',
      outlineColor: styles.outlineColor || '',
      outlineWidth: styles.outlineWidth || '',
      outlineOffset: styles.outlineOffset || '',
      boxShadow: styles.boxShadow || '',
      borderColor: styles.borderColor || '',
      backgroundColor: styles.backgroundColor || '',
      contrastRatio: ratio,
      meetsWCAG_AA: isVisible && ratio !== null && meetsAA(ratio),
    };
  }

  /**
   * Extract all tabbable elements from the DOM in tab order.
   *
   * Queries for focusable elements (`a[href]`, `button`, `input`,
   * `select`, `textarea`, `[tabindex]`), filters out hidden and
   * disabled elements, and sorts by `tabIndex` value.
   *
   * @returns Tab order entries sorted by actual tab key order.
   */
  async getTabOrder(): Promise<TabOrderEntry[]> {
    const result = (await this.cdp.send('Runtime.evaluate', {
      expression: GET_TAB_ORDER_JS,
      returnByValue: true,
    })) as { result: { value: TabOrderEntry[] } };

    return result.result.value ?? [];
  }

  /**
   * Detect whether focus is trapped inside a container.
   *
   * Focuses the first tabbable element inside the container, then
   * presses Tab repeatedly. If focus never leaves the container
   * after `maxTabs` presses, the container is a keyboard trap.
   *
   * @param selector - CSS selector for the container to test.
   * @param maxTabs - Maximum Tab presses before declaring a trap. Default 50.
   * @returns Traversal result indicating trap status.
   */
  async detectKeyboardTrap(
    selector: string,
    maxTabs: number = 50
  ): Promise<TraversalResult> {
    // Focus the first tabbable element in the container
    const focusResult = (await this.cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.querySelector(${JSON.stringify(selector)});
          if (!container) return { error: 'Container not found' };
          const focusable = container.querySelector(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable) return { error: 'No focusable elements in container' };
          focusable.focus();
          return { success: true };
        })()
      `,
      returnByValue: true,
    })) as { result: { value: { error?: string; success?: boolean } } };

    if (focusResult.result.value?.error) {
      return {
        isTrapped: false,
        tabCount: 0,
        visitedElements: [],
        escapeElement: null,
      };
    }

    const visitedElements: TabOrderEntry[] = [];
    let escapeElement: TabOrderEntry | null = null;

    for (let i = 0; i < maxTabs; i++) {
      await this.keyboard.press('Tab');
      // Short delay for focus to settle
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Check where focus is now
      const checkResult = (await this.cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const container = document.querySelector(${JSON.stringify(selector)});
            const el = document.activeElement;
            if (!el || el === document.body) return { outside: true, element: null };
            const rect = el.getBoundingClientRect();
            const entry = {
              index: ${`i`},
              tag: el.tagName,
              id: el.id || '',
              textContent: (el.textContent || '').trim().substring(0, 200),
              tabIndex: el.tabIndex,
              role: el.getAttribute('role') || '',
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            };
            const isInside = container && container.contains(el);
            return { outside: !isInside, element: entry };
          })()
        `,
        returnByValue: true,
      })) as {
        result: {
          value: {
            outside: boolean;
            element: TabOrderEntry | null;
          };
        };
      };

      const check = checkResult.result.value;

      if (check.element) {
        if (check.outside) {
          escapeElement = check.element;
          return {
            isTrapped: false,
            tabCount: i + 1,
            visitedElements,
            escapeElement,
          };
        }
        visitedElements.push(check.element);
      }
    }

    // If we exhausted all tabs and focus never left, it's a trap
    return {
      isTrapped: true,
      tabCount: maxTabs,
      visitedElements,
      escapeElement: null,
    };
  }

  /**
   * Extract the dominant color from a CSS box-shadow value.
   *
   * Takes the first color found in a `box-shadow` string.
   * Example: `"0px 0px 0px 3px rgb(52, 152, 219)"` → rgb(52, 152, 219)
   */
  private extractBoxShadowColor(boxShadow: string): ReturnType<typeof parseColor> {
    // Try to find an rgb/rgba color in the box-shadow
    const rgbMatch = boxShadow.match(/rgba?\([^)]+\)/);
    if (rgbMatch) {
      return parseColor(rgbMatch[0]);
    }

    // Try to find a hex color
    const hexMatch = boxShadow.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) {
      return parseColor(hexMatch[0]);
    }

    return null;
  }

  /**
   * Create a default "not visible" focus indicator.
   */
  private createEmptyIndicator(): FocusIndicator {
    return {
      isVisible: false,
      outline: '',
      outlineColor: '',
      outlineWidth: '',
      outlineOffset: '',
      boxShadow: '',
      borderColor: '',
      backgroundColor: '',
      contrastRatio: null,
      meetsWCAG_AA: false,
    };
  }
}
