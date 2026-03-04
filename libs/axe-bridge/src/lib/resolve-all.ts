/**
 * @module resolve-all
 *
 * Orchestrator that pipes axe-core results through all available
 * incomplete rule resolvers in sequence.
 *
 * Each resolver receives the output of the previous one, so resolved
 * findings accumulate through the pipeline.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, IncompleteResolutionOptions } from './types.js';
import { resolveIncompleteContrast } from './axe-bridge.js';
import { resolveIdenticalLinksSamePurpose } from './resolvers/identical-links-same-purpose.js';
import { resolveLinkInTextBlock } from './resolvers/link-in-text-block.js';
import { resolveTargetSize } from './resolvers/target-size.js';
import { resolveScrollableRegionFocusable } from './resolvers/scrollable-region-focusable.js';
import { resolveSkipLink } from './resolvers/skip-link.js';
import { resolveAriaHiddenFocus } from './resolvers/aria-hidden-focus.js';
import { resolveFocusIndicator } from './resolvers/focus-indicator.js';
import { resolveContentOnHover } from './resolvers/content-on-hover.js';
import { resolveFrameTested } from './resolvers/frame-tested.js';

/**
 * Resolver entry: a rule ID paired with its resolver function.
 *
 * The `invoke` function takes the CDP session, current results,
 * and the global options, and returns updated results.
 */
interface ResolverEntry {
  ruleId: string;
  invoke: (
    cdp: CDPSessionLike,
    results: AxeResults,
    options: IncompleteResolutionOptions,
  ) => Promise<AxeResults>;
}

/**
 * Ordered pipeline of resolvers. Each entry maps a rule ID to
 * its resolver function. The order is chosen to run simpler
 * resolvers first (pure DOM queries) and more complex ones
 * (screenshots, keyboard traversal) later.
 */
const RESOLVER_PIPELINE: ResolverEntry[] = [
  {
    ruleId: 'color-contrast',
    invoke: (cdp, results, opts) =>
      resolveIncompleteContrast(cdp, results, {
        wcagLevel: opts.wcagLevel,
        ...opts.contrast,
      }),
  },
  {
    ruleId: 'identical-links-same-purpose',
    invoke: (cdp, results) =>
      resolveIdenticalLinksSamePurpose(cdp, results),
  },
  {
    ruleId: 'link-in-text-block',
    invoke: (cdp, results, opts) =>
      resolveLinkInTextBlock(cdp, results, opts.linkInTextBlock),
  },
  {
    ruleId: 'target-size',
    invoke: (cdp, results, opts) =>
      resolveTargetSize(cdp, results, opts.targetSize),
  },
  {
    ruleId: 'scrollable-region-focusable',
    invoke: (cdp, results, opts) =>
      resolveScrollableRegionFocusable(cdp, results, opts.scrollableRegion),
  },
  {
    ruleId: 'skip-link',
    invoke: (cdp, results, opts) =>
      resolveSkipLink(cdp, results, opts.skipLink),
  },
  {
    ruleId: 'aria-hidden-focus',
    invoke: (cdp, results, opts) =>
      resolveAriaHiddenFocus(cdp, results, opts.ariaHiddenFocus),
  },
  {
    ruleId: 'focus-indicator',
    invoke: (cdp, results, opts) =>
      resolveFocusIndicator(cdp, results, opts.focusIndicator),
  },
  {
    ruleId: 'content-on-hover',
    invoke: (cdp, results, opts) =>
      resolveContentOnHover(cdp, results, opts.contentOnHover),
  },
  {
    ruleId: 'frame-tested',
    invoke: (cdp, results, opts) =>
      resolveFrameTested(cdp, results, opts.frameTested),
  },
];

/**
 * Resolve all incomplete axe-core results by running each resolver
 * in sequence.
 *
 * The pipeline processes rules in order:
 * 1. `color-contrast` — visual pixel analysis
 * 2. `identical-links-same-purpose` — URL normalization
 * 3. `link-in-text-block` — default-state style checks
 * 4. `target-size` — bounding box measurements
 * 5. `scrollable-region-focusable` — scroll + focus tests
 * 6. `skip-link` — focus visibility check
 * 7. `aria-hidden-focus` — Tab traversal
 * 8. `focus-indicator` — screenshot diff
 * 9. `content-on-hover` — hover + dismiss tests
 * 10. `frame-tested` — cross-origin iframe injection
 *
 * @param cdp - CDP session connected to the page being tested.
 * @param axeResults - Raw results from axe-core's `analyze()`.
 * @param options - Per-resolver options and `skipRules` filter.
 * @returns Modified axe results with all resolvable findings classified.
 *
 * @example
 * ```typescript
 * import { resolveAllIncomplete } from '@a11y-oracle/axe-bridge';
 *
 * const raw = await axe.run(document);
 * const resolved = await resolveAllIncomplete(cdp, raw, {
 *   wcagLevel: 'wcag22aa',
 *   skipRules: ['frame-tested'], // skip iframe injection
 * });
 * ```
 */
export async function resolveAllIncomplete(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
  options: IncompleteResolutionOptions = {},
): Promise<AxeResults> {
  const skipSet = new Set(options.skipRules ?? []);

  let current = axeResults;

  for (const entry of RESOLVER_PIPELINE) {
    // Skip if rule is in skipRules
    if (skipSet.has(entry.ruleId)) continue;

    // Skip if no incomplete entries exist for this rule
    const hasRule = current.incomplete.some((r) => r.id === entry.ruleId);
    if (!hasRule) continue;

    current = await entry.invoke(cdp, current, options);
  }

  return current;
}
