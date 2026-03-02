/**
 * @module @a11y-oracle/core-engine
 *
 * Core speech engine for A11y-Oracle. Connects to Chrome DevTools Protocol,
 * fetches the Accessibility Tree, and generates standardized speech output
 * based on W3C specifications.
 *
 * @example
 * ```typescript
 * import { SpeechEngine } from '@a11y-oracle/core-engine';
 * import type { CDPSessionLike } from '@a11y-oracle/core-engine';
 *
 * // Create engine with any CDP-compatible session
 * const engine = new SpeechEngine(cdpSession);
 * await engine.enable();
 *
 * // Get speech for the focused element
 * const result = await engine.getSpeech();
 * console.log(result?.speech); // "Products, button, collapsed"
 * ```
 *
 * @packageDocumentation
 */

export { SpeechEngine } from './lib/speech-engine.js';
export type {
  CDPSessionLike,
  SpeechResult,
  SpeechEngineOptions,
} from './lib/types.js';
export { ROLE_TO_SPEECH, LANDMARK_ROLES } from './lib/role-map.js';
export { STATE_MAPPINGS, extractStates } from './lib/state-map.js';
export type { StateMapping, AXNodeProperty } from './lib/state-map.js';
