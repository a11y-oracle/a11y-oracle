/**
 * @module wcag-thresholds
 *
 * Maps WCAG conformance levels to contrast ratio thresholds.
 *
 * WCAG defines two contrast requirements:
 * - **SC 1.4.3 (Level AA):** 4.5:1 for normal text, 3:1 for large text.
 * - **SC 1.4.6 (Level AAA):** 7:1 for normal text, 4.5:1 for large text.
 *
 * Level A has no contrast requirement. This module centralizes the
 * mapping so thresholds derive from the configured level rather than
 * being hardcoded throughout the codebase.
 */

import type { WcagLevel, ContrastThresholds } from './types.js';

/**
 * WCAG contrast thresholds by conformance tier.
 *
 * Each entry maps a WcagLevel to its contrast requirements.
 * Level A standards have no contrast SC, so they return null.
 */
const THRESHOLD_MAP: Record<WcagLevel, ContrastThresholds | null> = {
  // Level A — no contrast SC
  wcag2a: null,
  wcag21a: null,
  wcag22a: null,

  // Level AA — SC 1.4.3
  wcag2aa: { normalText: 4.5, largeText: 3.0 },
  wcag21aa: { normalText: 4.5, largeText: 3.0 },
  wcag22aa: { normalText: 4.5, largeText: 3.0 },
};

/** Default level when none is specified. */
const DEFAULT_LEVEL: WcagLevel = 'wcag22aa';

/**
 * Get WCAG contrast thresholds for a given conformance level.
 *
 * Returns the normal-text and large-text thresholds, or `null` if
 * the level does not include a contrast requirement (Level A).
 *
 * @param level - Target WCAG conformance level. Defaults to `'wcag22aa'`.
 * @returns Contrast thresholds, or null if contrast is not required.
 *
 * @example
 * ```typescript
 * const thresholds = getContrastThresholds('wcag22aa');
 * // { normalText: 4.5, largeText: 3.0 }
 *
 * const noContrast = getContrastThresholds('wcag22a');
 * // null (Level A has no contrast SC)
 * ```
 */
export function getContrastThresholds(
  level: WcagLevel = DEFAULT_LEVEL,
): ContrastThresholds | null {
  if (level in THRESHOLD_MAP) {
    return THRESHOLD_MAP[level];
  }
  return THRESHOLD_MAP[DEFAULT_LEVEL];
}
