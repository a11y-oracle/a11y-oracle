/**
 * @module identical-links-same-purpose
 *
 * Resolver for axe-core's `identical-links-same-purpose` incomplete rule
 * (WCAG 2.4.4 Link Purpose). Normalizes URLs and compares destinations
 * for links that share the same accessible text.
 */

import type { CDPSessionLike } from '@a11y-oracle/cdp-types';
import type { AxeResults, AxeNode } from '../types.js';
import {
  getSelector,
  cloneResults,
  findIncompleteRule,
  applyPromotions,
} from '../resolver-pipeline.js';

const RULE_ID = 'identical-links-same-purpose';

/**
 * Normalize a URL by stripping query parameters, hashes, trailing slashes,
 * and resolving relative paths against a base URL.
 *
 * @param href - The raw href to normalize.
 * @param baseUrl - The page's base URL for resolving relative paths.
 * @returns Normalized absolute URL string, or null if unparseable.
 */
export function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    // Strip query params and hash
    url.search = '';
    url.hash = '';
    // Normalize trailing slash: remove it unless path is just '/'
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${url.origin}${pathname}`;
  } catch {
    return null;
  }
}

/**
 * Resolve incomplete `identical-links-same-purpose` results.
 *
 * axe-core flags this when multiple links share the same accessible text
 * but have structurally different `href` attributes. This resolver
 * normalizes URLs (strips query params, hashes, resolves relative paths)
 * and compares canonical destinations.
 *
 * - Same canonical destination → **Pass**
 * - Different canonical destination → **Violation**
 *
 * @param cdp - CDP session for querying the page's base URL.
 * @param axeResults - Raw axe-core results.
 * @returns Modified results with resolved findings.
 */
export async function resolveIdenticalLinksSamePurpose(
  cdp: CDPSessionLike,
  axeResults: AxeResults,
): Promise<AxeResults> {
  const clone = cloneResults(axeResults);
  const found = findIncompleteRule(clone, RULE_ID);
  if (!found) return clone;

  const { index, rule } = found;

  // Get the page's base URL for resolving relative hrefs
  const baseUrlResult = await cdp.send('Runtime.evaluate', {
    expression: 'document.baseURI',
    returnByValue: true,
  }) as { result: { value: string } };
  const baseUrl = baseUrlResult.result.value ?? 'https://localhost';

  const passNodes: AxeNode[] = [];
  const violationNodes: AxeNode[] = [];
  const incompleteNodes: AxeNode[] = [];

  for (const node of rule.nodes) {
    const selector = getSelector(node);
    if (!selector) {
      incompleteNodes.push(node);
      continue;
    }

    // Get the link's href and related links' hrefs
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const href = el.getAttribute('href') || el.href;
        // Get the accessible text of this link
        const text = (el.textContent || '').trim().toLowerCase();
        // Find all links on the page with the same text
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        const sameTextLinks = allLinks.filter(
          a => (a.textContent || '').trim().toLowerCase() === text
        );
        return {
          href,
          relatedHrefs: sameTextLinks.map(a => a.getAttribute('href') || a.href),
        };
      })()`,
      returnByValue: true,
    }) as { result: { value: { href: string; relatedHrefs: string[] } | null } };

    const data = result.result.value;
    if (!data) {
      incompleteNodes.push(node);
      continue;
    }

    // Normalize all hrefs in the group
    const normalizedHrefs = data.relatedHrefs
      .map((h) => normalizeUrl(h, baseUrl))
      .filter((h): h is string => h !== null);

    // Check if all normalized hrefs are identical
    const uniqueUrls = new Set(normalizedHrefs);

    if (uniqueUrls.size <= 1) {
      // All links in the group go to the same destination
      passNodes.push(node);
    } else {
      // Links go to different destinations despite same text
      violationNodes.push(node);
    }
  }

  applyPromotions(clone, index, rule, {
    passNodes,
    violationNodes,
    incompleteNodes,
  });

  return clone;
}
