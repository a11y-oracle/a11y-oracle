/**
 * @module speech-engine
 *
 * The central class of A11y-Oracle. {@link SpeechEngine} connects to the
 * browser's Accessibility Tree via the Chrome DevTools Protocol and generates
 * standardized speech output following the format:
 *
 * ```
 * [Computed Name], [Role], [State/Properties]
 * ```
 *
 * Chrome's CDP already computes accessible names per the W3C AccName spec,
 * so the engine's job is to:
 * 1. Fetch the AXTree via `Accessibility.getFullAXTree()`
 * 2. Find the currently focused node
 * 3. Map the node's role and properties to human-readable strings
 * 4. Assemble the final speech string
 *
 * @example
 * ```typescript
 * import { SpeechEngine } from '@a11y-oracle/core-engine';
 *
 * const engine = new SpeechEngine(cdpSession);
 * await engine.enable();
 *
 * const result = await engine.getSpeech();
 * console.log(result?.speech); // "Products, button, collapsed"
 * ```
 */

import type { Protocol } from 'devtools-protocol';
import type { CDPSessionLike, SpeechEngineOptions, SpeechResult } from './types.js';
import { ROLE_TO_SPEECH, LANDMARK_ROLES } from './role-map.js';
import { extractStates } from './state-map.js';
import type { AXNodeProperty } from './state-map.js';

/**
 * Generates standardized speech output from the browser's Accessibility Tree.
 *
 * The engine operates through a {@link CDPSessionLike} interface, making it
 * framework-agnostic. It works with Playwright's CDP sessions, raw WebSocket
 * connections, or any other CDP-compatible client.
 *
 * ## Speech Output Format
 *
 * Every element produces a string in this format:
 * ```
 * [Computed Name], [Role], [State/Properties]
 * ```
 *
 * Parts are omitted if they are empty. For example:
 * - `"Products, button, collapsed"` — name + role + state
 * - `"Main, navigation landmark"` — name + role (landmark)
 * - `"Home, link"` — name + role (no states)
 *
 * ## Landmark Roles
 *
 * Landmark roles (navigation, main, banner, etc.) automatically append
 * the word "landmark" to their role string unless
 * {@link SpeechEngineOptions.includeLandmarks} is set to `false`.
 */
export class SpeechEngine {
  private cdp: CDPSessionLike;
  private options: Required<SpeechEngineOptions>;

  /**
   * Create a new SpeechEngine instance.
   *
   * @param cdp - A CDP session-like object for sending protocol commands.
   * @param options - Optional configuration for speech output behavior.
   */
  constructor(cdp: CDPSessionLike, options: SpeechEngineOptions = {}) {
    this.cdp = cdp;
    this.options = {
      includeLandmarks: options.includeLandmarks ?? true,
      includeDescription: options.includeDescription ?? false,
    };
  }

  /**
   * Enable the CDP Accessibility domain.
   *
   * Must be called before any other method. Enables the browser to
   * start tracking and reporting accessibility tree data.
   */
  async enable(): Promise<void> {
    await this.cdp.send('Accessibility.enable');
  }

  /**
   * Disable the CDP Accessibility domain.
   *
   * Call this when you're done using the engine to free browser resources.
   */
  async disable(): Promise<void> {
    await this.cdp.send('Accessibility.disable');
  }

  /**
   * Get the speech output for the currently focused element.
   *
   * Fetches the full AXTree, locates the node with `focused: true`,
   * and computes its speech string.
   *
   * @returns The {@link SpeechResult} for the focused element, or `null`
   *          if no element has focus or the focused element is ignored.
   *
   * @example
   * ```typescript
   * // After pressing Tab to focus a button
   * const result = await engine.getSpeech();
   * console.log(result?.speech); // "Products, button, collapsed"
   * console.log(result?.name);   // "Products"
   * console.log(result?.role);   // "button"
   * console.log(result?.states); // ["collapsed"]
   * ```
   */
  async getSpeech(): Promise<SpeechResult | null> {
    const { nodes } = await this.cdp.send('Accessibility.getFullAXTree');
    const focusedNode = this.findFocusedNode(nodes);
    if (!focusedNode) return null;
    return this.computeSpeech(focusedNode);
  }

  /**
   * Get speech output for ALL non-ignored, non-silent nodes in the tree.
   *
   * Useful for asserting on landmarks, headings, or other structural
   * elements that may not have focus.
   *
   * @returns An array of {@link SpeechResult} objects for every visible
   *          node that produces speech output.
   *
   * @example
   * ```typescript
   * const all = await engine.getFullTreeSpeech();
   * const nav = all.find(r => r.speech === 'Main, navigation landmark');
   * expect(nav).toBeDefined();
   * ```
   */
  async getFullTreeSpeech(): Promise<SpeechResult[]> {
    const { nodes } = await this.cdp.send('Accessibility.getFullAXTree');
    return nodes
      .map((node) => this.computeSpeech(node))
      .filter((result): result is SpeechResult => result !== null);
  }

  /**
   * Find the node with `focused: true` in the flat AXTree node list.
   *
   * CDP returns the AXTree as a flat array. Each node may have a
   * `focused` property in its `properties` array.
   *
   * @param nodes - The flat array of AXNodes from `getFullAXTree()`.
   * @returns The focused node, or `null` if no node is focused.
   */
  findFocusedNode(
    nodes: Protocol.Accessibility.AXNode[]
  ): Protocol.Accessibility.AXNode | null {
    return (
      nodes.find((node) => {
        const focused = node.properties?.find((p) => p.name === 'focused');
        return focused?.value?.value === true;
      }) ?? null
    );
  }

  /**
   * Compute the speech string for a single AXNode.
   *
   * Follows the output format: `[Computed Name], [Role], [State/Properties]`.
   * Parts are omitted when empty. Ignored nodes and nodes with no
   * meaningful content return `null`.
   *
   * @param node - A CDP AXNode from the accessibility tree.
   * @returns A {@link SpeechResult} with the computed speech, or `null`
   *          if the node should be silent (ignored, no role, no name).
   *
   * @example
   * ```typescript
   * const result = engine.computeSpeech(axNode);
   * // { speech: "Products, button, collapsed", name: "Products", ... }
   * ```
   */
  computeSpeech(node: Protocol.Accessibility.AXNode): SpeechResult | null {
    const role = node.role?.value as string | undefined;
    if (!role) return null;

    // Skip ignored/invisible nodes
    if (node.ignored) return null;

    const name = (node.name?.value as string) ?? '';
    let speechRole = ROLE_TO_SPEECH[role] ?? role;

    // Skip nodes with no role output and no name (generic containers, etc.)
    if (!speechRole && !name) return null;

    // Append "landmark" to landmark roles
    if (this.options.includeLandmarks && LANDMARK_ROLES.has(role)) {
      speechRole = `${speechRole} landmark`;
    }

    const states = extractStates(node.properties as AXNodeProperty[] | undefined);

    // Build the speech parts: [name], [role], [states...]
    const parts: string[] = [];
    if (name) parts.push(name);
    if (speechRole) parts.push(speechRole);
    parts.push(...states);

    // Optionally include description
    if (this.options.includeDescription) {
      const description = (node.description?.value as string) ?? '';
      if (description) parts.push(description);
    }

    const speech = parts.join(', ');

    // Don't return results with empty speech
    if (!speech) return null;

    return {
      speech,
      name,
      role: speechRole,
      states,
      rawNode: node,
    };
  }
}
