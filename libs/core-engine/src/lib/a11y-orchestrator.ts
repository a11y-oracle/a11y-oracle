/**
 * @module a11y-orchestrator
 *
 * Coordinates the three sub-engines (Speech, Keyboard, Focus) into a
 * single `pressKey()` → unified-state workflow.
 *
 * @example
 * ```typescript
 * import { A11yOrchestrator } from '@a11y-oracle/core-engine';
 *
 * const oracle = new A11yOrchestrator(cdpSession);
 * await oracle.enable();
 *
 * const state = await oracle.pressKey('Tab');
 * console.log(state.speech);                       // "Products, button, collapsed"
 * console.log(state.focusedElement?.tag);           // "BUTTON"
 * console.log(state.focusIndicator.meetsWCAG_AA);  // true
 * ```
 */

import type {
  CDPSessionLike,
  A11yState,
  A11yFocusedElement,
  A11yFocusIndicator,
  A11yOrchestratorOptions,
} from './types.js';
import { SpeechEngine } from './speech-engine.js';
import { KeyboardEngine } from '@a11y-oracle/keyboard-engine';
import type { ModifierKeys, FocusedElementInfo } from '@a11y-oracle/keyboard-engine';
import { FocusAnalyzer } from '@a11y-oracle/focus-analyzer';
import type {
  TabOrderReport,
  TraversalResult,
} from '@a11y-oracle/focus-analyzer';

/**
 * Orchestrates speech, keyboard dispatch, and focus analysis into a
 * unified accessibility testing API.
 *
 * A single `pressKey()` call dispatches a keystroke, waits for focus
 * to settle, then collects speech output, focused element info, and
 * focus indicator analysis in parallel.
 *
 * ## Sub-engines
 *
 * | Engine | Responsibility |
 * |--------|---------------|
 * | {@link SpeechEngine} | AXTree → speech string |
 * | {@link KeyboardEngine} | CDP key dispatch + `document.activeElement` |
 * | {@link FocusAnalyzer} | CSS focus indicator + tab order + trap detection |
 */
export class A11yOrchestrator {
  private speech: SpeechEngine;
  private keyboard: KeyboardEngine;
  private focusAnalyzer: FocusAnalyzer;
  private options: Required<A11yOrchestratorOptions>;

  /**
   * @param cdp - CDP session for sending protocol commands.
   * @param options - Optional configuration for speech output and focus settling.
   */
  constructor(cdp: CDPSessionLike, options: A11yOrchestratorOptions = {}) {
    this.speech = new SpeechEngine(cdp, options);
    this.keyboard = new KeyboardEngine(cdp);
    this.focusAnalyzer = new FocusAnalyzer(cdp);
    this.options = {
      includeLandmarks: options.includeLandmarks ?? true,
      includeDescription: options.includeDescription ?? false,
      focusSettleMs: options.focusSettleMs ?? 50,
    };
  }

  /**
   * Enable the CDP Accessibility domain.
   *
   * Must be called before any other method.
   */
  async enable(): Promise<void> {
    await this.speech.enable();
  }

  /**
   * Disable the CDP Accessibility domain.
   *
   * Call this when done to free browser resources.
   */
  async disable(): Promise<void> {
    await this.speech.disable();
  }

  /**
   * Dispatch a key press and return the unified accessibility state.
   *
   * 1. Dispatches `keyDown` + `keyUp` via CDP `Input.dispatchKeyEvent`.
   * 2. Waits {@link A11yOrchestratorOptions.focusSettleMs} for transitions.
   * 3. Collects speech, focused element, and focus indicator **in parallel**.
   *
   * @param key - Key name (e.g. `'Tab'`, `'Enter'`, `'ArrowDown'`).
   * @param modifiers - Optional modifier keys.
   * @returns Unified accessibility state snapshot.
   *
   * @example
   * ```typescript
   * const state = await orchestrator.pressKey('Tab');
   * expect(state.speech).toBe('Products, button, collapsed');
   * expect(state.focusIndicator.meetsWCAG_AA).toBe(true);
   * ```
   */
  async pressKey(key: string, modifiers?: ModifierKeys): Promise<A11yState> {
    await this.keyboard.press(key, modifiers);

    // Wait for focus transitions and CSS animations to settle
    if (this.options.focusSettleMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.options.focusSettleMs)
      );
    }

    return this.getState();
  }

  /**
   * Get the current unified accessibility state without pressing a key.
   *
   * Collects speech, focused element, and focus indicator in parallel.
   *
   * @returns Unified accessibility state snapshot.
   */
  async getState(): Promise<A11yState> {
    const [speechResult, focusedElementInfo, focusIndicator] =
      await Promise.all([
        this.speech.getSpeech(),
        this.keyboard.getFocusedElement(),
        this.focusAnalyzer.getFocusIndicator(),
      ]);

    const focusedElement = focusedElementInfo
      ? this.mapFocusedElement(focusedElementInfo)
      : null;

    const a11yFocusIndicator: A11yFocusIndicator = {
      isVisible: focusIndicator.isVisible,
      contrastRatio: focusIndicator.contrastRatio,
      meetsWCAG_AA: focusIndicator.meetsWCAG_AA,
    };

    return {
      speech: speechResult?.speech ?? '',
      speechResult,
      focusedElement,
      focusIndicator: a11yFocusIndicator,
    };
  }

  /**
   * Extract all tabbable elements in DOM tab order.
   *
   * @returns Report with sorted tab order entries and total count.
   */
  async traverseTabOrder(): Promise<TabOrderReport> {
    const entries = await this.focusAnalyzer.getTabOrder();
    return {
      entries,
      totalCount: entries.length,
    };
  }

  /**
   * Detect whether a container traps keyboard focus.
   *
   * Focuses the first tabbable element in the container, then
   * presses Tab repeatedly. If focus never escapes after `maxTabs`
   * presses, the container is a keyboard trap (WCAG 2.1.2 failure).
   *
   * @param selector - CSS selector for the container to test.
   * @param maxTabs - Maximum Tab presses before declaring a trap. Default 50.
   * @returns Traversal result indicating whether focus is trapped.
   */
  async traverseSubTree(
    selector: string,
    maxTabs?: number
  ): Promise<TraversalResult> {
    return this.focusAnalyzer.detectKeyboardTrap(selector, maxTabs);
  }

  /**
   * Map a raw `FocusedElementInfo` from keyboard-engine to the
   * orchestrator's `A11yFocusedElement` shape.
   */
  private mapFocusedElement(info: FocusedElementInfo): A11yFocusedElement {
    return {
      tag: info.tag,
      id: info.id,
      className: info.className,
      textContent: info.textContent,
      role: info.role,
      ariaLabel: info.ariaLabel,
      tabIndex: info.tabIndex,
      rect: info.rect,
    };
  }
}
