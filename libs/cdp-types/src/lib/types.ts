/**
 * @module types
 *
 * Shared Chrome DevTools Protocol type definitions used across
 * all A11y-Oracle engine libraries.
 */

/**
 * Minimal interface for a Chrome DevTools Protocol session.
 *
 * This is the abstraction boundary between the engine libraries and
 * framework plugins. Engine libraries never import Playwright or
 * Cypress — they only depend on this interface.
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
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}
