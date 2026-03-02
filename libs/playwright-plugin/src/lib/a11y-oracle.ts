/**
 * @module a11y-oracle
 *
 * Playwright wrapper around the core {@link SpeechEngine}.
 * Manages the CDP session lifecycle and provides a clean API for
 * accessibility speech assertions in Playwright tests.
 *
 * @example
 * ```typescript
 * import { A11yOracle } from '@a11y-oracle/playwright-plugin';
 *
 * const a11y = new A11yOracle(page);
 * await a11y.init();
 *
 * await a11y.press('Tab');
 * const speech = await a11y.getSpeech();
 * expect(speech).toBe('Products, button, collapsed');
 *
 * await a11y.dispose();
 * ```
 */

import type { Page, CDPSession } from '@playwright/test';
import { SpeechEngine } from '@a11y-oracle/core-engine';
import type { SpeechResult, SpeechEngineOptions } from '@a11y-oracle/core-engine';

/**
 * Playwright wrapper that manages a CDP session and provides
 * accessibility speech output for the currently focused element.
 *
 * For most use cases, prefer the {@link test} fixture from the
 * package root, which handles init/dispose automatically.
 *
 * ## CDP Requirement
 *
 * This class requires a Chromium-based browser. CDP sessions are
 * not available for Firefox or WebKit in Playwright.
 */
export class A11yOracle {
  private page: Page;
  private cdpSession: CDPSession | null = null;
  private engine: SpeechEngine | null = null;
  private options: SpeechEngineOptions;

  /**
   * Create a new A11yOracle instance.
   *
   * @param page - The Playwright Page to attach to.
   * @param options - Optional speech engine configuration.
   */
  constructor(page: Page, options: SpeechEngineOptions = {}) {
    this.page = page;
    this.options = options;
  }

  /**
   * Initialize the CDP session and enable the Accessibility domain.
   *
   * Must be called before {@link getSpeech}, {@link press}, or
   * {@link getFullTreeSpeech}. The {@link test} fixture calls this
   * automatically.
   *
   * @throws Error if the browser does not support CDP (e.g., Firefox).
   */
  async init(): Promise<void> {
    this.cdpSession = await this.page.context().newCDPSession(this.page);
    this.engine = new SpeechEngine(this.cdpSession, this.options);
    await this.engine.enable();
  }

  /**
   * Press a keyboard key and return the speech for the newly focused element.
   *
   * Internally calls `page.keyboard.press(key)` followed by a short delay
   * to allow the browser to update focus and ARIA states before reading
   * the accessibility tree.
   *
   * @param key - The key to press (e.g., `'Tab'`, `'Enter'`, `'Escape'`).
   *              Uses Playwright's key name format.
   * @returns The speech string for the focused element after the key press,
   *          or an empty string if no element has focus.
   *
   * @example
   * ```typescript
   * const speech = await a11y.press('Tab');
   * expect(speech).toBe('Products, button, collapsed');
   * ```
   */
  async press(key: string): Promise<string> {
    await this.page.keyboard.press(key);
    // Allow browser to update focus and ARIA states
    await this.page.waitForTimeout(50);
    return this.getSpeech();
  }

  /**
   * Get the speech string for the currently focused element.
   *
   * @returns The speech string (e.g., `"Products, button, collapsed"`),
   *          or an empty string if no element has focus.
   *
   * @throws Error if {@link init} has not been called.
   *
   * @example
   * ```typescript
   * await page.focus('#my-button');
   * const speech = await a11y.getSpeech();
   * expect(speech).toBe('Submit, button');
   * ```
   */
  async getSpeech(): Promise<string> {
    const result = await this.getSpeechResult();
    return result?.speech ?? '';
  }

  /**
   * Get the full {@link SpeechResult} for the currently focused element.
   *
   * Use this when you need access to individual parts (name, role, states)
   * or the raw CDP AXNode.
   *
   * @returns The full speech result, or `null` if no element has focus.
   * @throws Error if {@link init} has not been called.
   */
  async getSpeechResult(): Promise<SpeechResult | null> {
    if (!this.engine) {
      throw new Error('A11yOracle not initialized. Call init() first.');
    }
    return this.engine.getSpeech();
  }

  /**
   * Get speech output for ALL non-ignored nodes in the accessibility tree.
   *
   * Useful for asserting on landmarks, headings, or other structural
   * elements that don't have focus.
   *
   * @returns Array of {@link SpeechResult} objects for every visible node.
   * @throws Error if {@link init} has not been called.
   *
   * @example
   * ```typescript
   * const all = await a11y.getFullTreeSpeech();
   * const nav = all.find(r => r.speech === 'Main, navigation landmark');
   * expect(nav).toBeDefined();
   * ```
   */
  async getFullTreeSpeech(): Promise<SpeechResult[]> {
    if (!this.engine) {
      throw new Error('A11yOracle not initialized. Call init() first.');
    }
    return this.engine.getFullTreeSpeech();
  }

  /**
   * Detach the CDP session and clean up resources.
   *
   * The {@link test} fixture calls this automatically after each test.
   */
  async dispose(): Promise<void> {
    if (this.cdpSession) {
      await this.cdpSession.detach();
      this.cdpSession = null;
      this.engine = null;
    }
  }
}
