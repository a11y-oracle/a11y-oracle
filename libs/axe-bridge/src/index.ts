/**
 * @module @a11y-oracle/axe-bridge
 *
 * Axe-core result post-processor that resolves "incomplete" color contrast
 * warnings using visual pixel analysis and CSS halo heuristics. Drop-in
 * middleware between axe-core's `analyze()` and your assertion layer.
 *
 * @packageDocumentation
 */

export { resolveIncompleteContrast } from './lib/axe-bridge.js';
export type {
  ContrastResolutionOptions,
  AxeResults,
  AxeRule,
  AxeNode,
  AxeCheck,
} from './lib/types.js';
