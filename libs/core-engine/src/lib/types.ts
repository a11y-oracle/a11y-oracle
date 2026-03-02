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
