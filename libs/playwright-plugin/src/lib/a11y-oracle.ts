/**
 * @module a11y-oracle
 *
 * Playwright wrapper around the core {@link SpeechEngine} and
 * {@link A11yOrchestrator}. Manages the CDP session lifecycle and
 * provides a clean API for accessibility speech and keyboard/focus
 * assertions in Playwright tests.
 *
 * @example
 * ```typescript
 * import { A11yOracle } from '@a11y-oracle/playwright-plugin';
 *
 * const a11y = new A11yOracle(page);
 * await a11y.init();
 *
 * // Speech-only API (backward compatible)
 * const speech = await a11y.press('Tab');
 * expect(speech).toBe('Products, button, collapsed');
 *
 * // Unified state API (new)
 * const state = await a11y.pressKey('Tab');
 * expect(state.speech).toContain('Products');
 * expect(state.focusIndicator.meetsWCAG_AA).toBe(true);
 *
 * await a11y.dispose();
 * ```
 */

import type { Page, CDPSession } from '@playwright/test';
import { SpeechEngine } from '@a11y-oracle/core-engine';
import { A11yOrchestrator } from '@a11y-oracle/core-engine';
import type {
  SpeechResult,
  A11yState,
  A11yOrchestratorOptions,
  TabOrderReport,
  TraversalResult,
  ModifierKeys,
} from '@a11y-oracle/core-engine';

/**
 * Playwright wrapper that manages a CDP session and provides
 * accessibility speech output and keyboard/focus analysis for the
 * currently focused element.
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
  private orchestrator: A11yOrchestrator | null = null;
  private options: A11yOrchestratorOptions;

  /**
   * Create a new A11yOracle instance.
   *
   * @param page - The Playwright Page to attach to.
   * @param options - Optional speech engine and orchestrator configuration.
   */
  constructor(page: Page, options: A11yOrchestratorOptions = {}) {
    this.page = page;
    this.options = options;
  }

  /**
   * Initialize the CDP session and enable the Accessibility domain.
   *
   * Must be called before any other method. The {@link test} fixture
   * calls this automatically.
   *
   * @throws Error if the browser does not support CDP (e.g., Firefox).
   */
  async init(): Promise<void> {
    this.cdpSession = await this.page.context().newCDPSession(this.page);
    this.engine = new SpeechEngine(this.cdpSession, this.options);
    this.orchestrator = new A11yOrchestrator(this.cdpSession, this.options);
    await this.orchestrator.enable();
  }

  // ── Speech-only API (backward compatible) ──────────────────────

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
   */
  async getSpeech(): Promise<string> {
    const result = await this.getSpeechResult();
    return result?.speech ?? '';
  }

  /**
   * Get the full {@link SpeechResult} for the currently focused element.
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
   * @returns Array of {@link SpeechResult} objects for every visible node.
   * @throws Error if {@link init} has not been called.
   */
  async getFullTreeSpeech(): Promise<SpeechResult[]> {
    if (!this.engine) {
      throw new Error('A11yOracle not initialized. Call init() first.');
    }
    return this.engine.getFullTreeSpeech();
  }

  // ── Unified state API (new) ────────────────────────────────────

  /**
   * Dispatch a key via CDP and return the unified accessibility state.
   *
   * Unlike {@link press}, this uses native CDP key dispatch (not
   * Playwright's keyboard API) and returns the full {@link A11yState}
   * including speech, focused element info, and focus indicator analysis.
   *
   * @param key - Key name (e.g. `'Tab'`, `'Enter'`, `'ArrowDown'`).
   * @param modifiers - Optional modifier keys (shift, ctrl, alt, meta).
   * @returns Unified accessibility state snapshot.
   *
   * @example
   * ```typescript
   * const state = await a11y.pressKey('Tab');
   * expect(state.speech).toContain('Products');
   * expect(state.focusIndicator.meetsWCAG_AA).toBe(true);
   * ```
   */
  async pressKey(key: string, modifiers?: ModifierKeys): Promise<A11yState> {
    this.assertOrchestrator();
    return this.orchestrator!.pressKey(key, modifiers);
  }

  /**
   * Get the current unified accessibility state without pressing a key.
   *
   * @returns Unified accessibility state snapshot.
   */
  async getA11yState(): Promise<A11yState> {
    this.assertOrchestrator();
    return this.orchestrator!.getState();
  }

  /**
   * Extract all tabbable elements in DOM tab order.
   *
   * @returns Report with sorted tab order entries and total count.
   */
  async traverseTabOrder(): Promise<TabOrderReport> {
    this.assertOrchestrator();
    return this.orchestrator!.traverseTabOrder();
  }

  /**
   * Detect whether a container traps keyboard focus (WCAG 2.1.2).
   *
   * @param selector - CSS selector for the container to test.
   * @param maxTabs - Maximum Tab presses before declaring a trap. Default 50.
   * @returns Traversal result indicating whether focus is trapped.
   */
  async traverseSubTree(
    selector: string,
    maxTabs?: number
  ): Promise<TraversalResult> {
    this.assertOrchestrator();
    return this.orchestrator!.traverseSubTree(selector, maxTabs);
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /**
   * Detach the CDP session and clean up resources.
   *
   * The {@link test} fixture calls this automatically after each test.
   */
  async dispose(): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.disable();
      this.orchestrator = null;
    }
    if (this.cdpSession) {
      await this.cdpSession.detach();
      this.cdpSession = null;
      this.engine = null;
    }
  }

  private assertOrchestrator(): void {
    if (!this.orchestrator) {
      throw new Error('A11yOracle not initialized. Call init() first.');
    }
  }
}
