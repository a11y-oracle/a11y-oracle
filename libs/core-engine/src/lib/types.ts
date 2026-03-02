/**
 * @module types
 *
 * Core type definitions for the A11y-Oracle speech engine.
 *
 * The key abstraction is {@link CDPSessionLike}, which decouples the engine
 * from any specific test framework. Both Playwright's `CDPSession` and a raw
 * WebSocket CDP client can satisfy this interface.
 */

import type { Protocol } from 'devtools-protocol';

/**
 * Minimal interface for a Chrome DevTools Protocol session.
 *
 * This is the abstraction boundary between the core engine and framework
 * plugins. The engine never imports Playwright or Cypress — it only
 * depends on this interface.
 *
 * Both Playwright's `CDPSession` and `chrome-remote-interface` clients
 * are compatible with this interface.
 *
 * @example
 * ```typescript
 * // Playwright
 * const cdp: CDPSessionLike = await page.context().newCDPSession(page);
 *
 * // chrome-remote-interface
 * const cdp: CDPSessionLike = await CDP({ port: 9222 });
 * ```
 */
export interface CDPSessionLike {
  send(
    method: 'Accessibility.enable'
  ): Promise<void>;
  send(
    method: 'Accessibility.disable'
  ): Promise<void>;
  send(
    method: 'Accessibility.getFullAXTree',
    params?: { depth?: number; frameId?: string }
  ): Promise<Protocol.Accessibility.GetFullAXTreeResponse>;
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * The result of computing speech output for a single accessibility node.
 *
 * Contains both the final speech string and its constituent parts for
 * granular assertions.
 *
 * @example
 * ```typescript
 * const result: SpeechResult = {
 *   speech: 'Products, button, collapsed',
 *   name: 'Products',
 *   role: 'button',
 *   states: ['collapsed'],
 *   rawNode: { ... } // CDP AXNode
 * };
 * ```
 */
export interface SpeechResult {
  /** The full speech string, e.g. `"Products, button, collapsed"`. */
  speech: string;
  /** The computed accessible name. */
  name: string;
  /** The human-readable role string (already mapped from CDP role). */
  role: string;
  /** Array of state strings, e.g. `["collapsed"]`, `["checked", "required"]`. */
  states: string[];
  /** The raw CDP AXNode for advanced inspection. */
  rawNode: Protocol.Accessibility.AXNode;
}

/**
 * DOM-level information about the currently focused element.
 *
 * This is the orchestrator's view of the focused element — a simpler,
 * framework-agnostic shape compared to `FocusedElementInfo` from
 * keyboard-engine (which is a raw CDP extraction type).
 */
export interface A11yFocusedElement {
  /** Tag name, e.g. `'BUTTON'`. */
  tag: string;
  /** Element `id` attribute, or empty string. */
  id: string;
  /** Element `className` attribute, or empty string. */
  className: string;
  /** Trimmed text content of the element. */
  textContent: string;
  /** The element's `role` attribute, or empty string. */
  role: string;
  /** The element's `aria-label` attribute, or empty string. */
  ariaLabel: string;
  /** The element's `tabIndex` property. */
  tabIndex: number;
  /** Bounding rectangle in viewport coordinates. */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * Visual focus indicator analysis from CSS computed styles.
 *
 * A simplified projection of the full {@link FocusIndicator} from
 * `@a11y-oracle/focus-analyzer`, carrying only the fields needed
 * for unified state assertions.
 */
export interface A11yFocusIndicator {
  /** Whether any visual focus indicator is detected. */
  isVisible: boolean;
  /**
   * Contrast ratio of the focus indicator against the background.
   * `null` if the colors could not be reliably parsed.
   */
  contrastRatio: number | null;
  /**
   * Whether the indicator meets WCAG 2.4.12 AA
   * (contrast ≥ 3.0 and indicator is visible).
   */
  meetsWCAG_AA: boolean;
}

/**
 * Unified accessibility state combining speech output, focus information,
 * and visual indicator analysis.
 *
 * Returned by {@link A11yOrchestrator.pressKey} and
 * {@link A11yOrchestrator.getState} to give a single snapshot of
 * "what the screen reader says" + "where focus is" + "how focus looks".
 *
 * @example
 * ```typescript
 * const state = await orchestrator.pressKey('Tab');
 * console.log(state.speech);           // "Products, button, collapsed"
 * console.log(state.focusedElement?.tag); // "BUTTON"
 * console.log(state.focusIndicator.meetsWCAG_AA); // true
 * ```
 */
export interface A11yState {
  /** The full speech string, e.g. `"Products, button, collapsed"`. */
  speech: string;
  /** The full speech result with raw AXNode data. `null` if no focused element. */
  speechResult: SpeechResult | null;
  /** DOM-level info about the focused element. `null` if no element has focus. */
  focusedElement: A11yFocusedElement | null;
  /** Visual focus indicator analysis. */
  focusIndicator: A11yFocusIndicator;
}

/**
 * Configuration options for the {@link A11yOrchestrator}.
 */
export interface A11yOrchestratorOptions extends SpeechEngineOptions {
  /**
   * Milliseconds to wait after a key press before reading state,
   * allowing CSS transitions and focus events to settle.
   * Defaults to `50`.
   */
  focusSettleMs?: number;
}

/**
 * Configuration options for the {@link SpeechEngine}.
 */
export interface SpeechEngineOptions {
  /**
   * Whether to include landmark roles in speech output.
   * When `true` (default), landmarks like `<nav>` produce
   * `"Main, navigation landmark"`.
   */
  includeLandmarks?: boolean;

  /**
   * Whether to include the accessible description in speech output.
   * When `true`, the description is appended after states.
   * Defaults to `false`.
   */
  includeDescription?: boolean;
}
