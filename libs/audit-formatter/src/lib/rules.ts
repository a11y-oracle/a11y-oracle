/**
 * @module rules
 *
 * Oracle audit rule definitions with WCAG metadata.
 *
 * Each rule maps to a specific WCAG criterion and carries all the metadata
 * needed to produce a fully populated OracleIssue. Rules are keyed by their
 * `ruleId` (e.g., `oracle/focus-not-visible`).
 */

import type { OracleRule, WcagLevel } from './types.js';

/**
 * All defined Oracle audit rules.
 *
 * Focus indicator rules:
 * - `oracle/focus-not-visible` — WCAG 2.4.7 Focus Visible (Level AA)
 * - `oracle/focus-low-contrast` — WCAG 2.4.12 Focus Appearance (Level AA, WCAG 2.2)
 *
 * Keyboard navigation rules:
 * - `oracle/keyboard-trap` — WCAG 2.1.2 No Keyboard Trap (Level A)
 * - `oracle/focus-missing-name` — WCAG 4.1.2 Name, Role, Value (Level A)
 * - `oracle/focus-generic-role` — WCAG 4.1.2 Name, Role, Value (Level A)
 * - `oracle/positive-tabindex` — WCAG 2.4.3 Focus Order (Level A)
 */
export const RULES: Record<string, OracleRule> = {
  'oracle/focus-not-visible': {
    ruleId: 'oracle/focus-not-visible',
    help: 'Focused element must have a visible focus indicator',
    description:
      'Ensures that every interactive element has a visible focus indicator ' +
      'when focused via the keyboard. A missing focus indicator makes it ' +
      'impossible for keyboard users to know where they are on the page.',
    impact: 'serious',
    tags: ['wcag2aa', 'wcag247', 'cat.keyboard', 'oracle'],
    helpUrl:
      'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
    failureSummary:
      'Fix any of the following:\n' +
      '  Element has no visible focus indicator when focused via keyboard.',
  },

  'oracle/focus-low-contrast': {
    ruleId: 'oracle/focus-low-contrast',
    help: 'Focus indicator must have sufficient contrast (>= 3:1)',
    description:
      'Ensures the visual focus indicator has a contrast ratio of at least ' +
      '3:1 against the background, meeting WCAG 2.4.12 (Focus Appearance) ' +
      'AA requirements.',
    impact: 'moderate',
    tags: ['wcag22aa', 'wcag2412', 'cat.keyboard', 'oracle'],
    helpUrl:
      'https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html',
    failureSummary:
      'Fix any of the following:\n' +
      '  Focus indicator contrast ratio is below the 3:1 minimum.',
  },

  'oracle/keyboard-trap': {
    ruleId: 'oracle/keyboard-trap',
    help: 'Interactive content must not trap keyboard focus',
    description:
      'Ensures that keyboard focus can be moved away from any interactive ' +
      'component using the keyboard alone. A keyboard trap prevents users ' +
      'from navigating the rest of the page.',
    impact: 'critical',
    tags: ['wcag2a', 'wcag212', 'cat.keyboard', 'oracle'],
    helpUrl:
      'https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html',
    failureSummary:
      'Fix any of the following:\n' +
      '  Keyboard focus is trapped within the container and cannot escape.',
  },

  'oracle/focus-missing-name': {
    ruleId: 'oracle/focus-missing-name',
    help: 'Focused element must have an accessible name',
    description:
      'Ensures that interactive elements have a non-empty computed accessible ' +
      'name when focused via the keyboard. Without an accessible name, screen ' +
      'readers cannot identify the element to users.',
    impact: 'serious',
    tags: ['wcag2a', 'wcag412', 'cat.keyboard', 'oracle'],
    helpUrl:
      'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    failureSummary:
      'Fix any of the following:\n' +
      '  Focused element has no accessible name (aria-label, aria-labelledby, or text content).',
  },

  'oracle/focus-generic-role': {
    ruleId: 'oracle/focus-generic-role',
    help: 'Focused element must have a meaningful role',
    description:
      'Ensures that interactive elements exposed to the keyboard have a ' +
      'meaningful ARIA role. Elements with generic, presentation, or none ' +
      'roles provide no semantic information to assistive technologies.',
    impact: 'serious',
    tags: ['wcag2a', 'wcag412', 'cat.keyboard', 'oracle'],
    helpUrl:
      'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    failureSummary:
      'Fix any of the following:\n' +
      '  Focused element has a generic or presentational role instead of a semantic role.',
  },

  'oracle/positive-tabindex': {
    ruleId: 'oracle/positive-tabindex',
    help: 'Elements should not use positive tabindex values',
    description:
      'Ensures that elements in the tab order do not use tabindex values ' +
      'greater than 0. Positive tabindex creates an unpredictable focus ' +
      'order that diverges from the visual reading order, making keyboard ' +
      'navigation confusing for users.',
    impact: 'serious',
    tags: ['wcag2a', 'wcag243', 'cat.keyboard', 'oracle'],
    helpUrl:
      'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
    failureSummary:
      'Fix any of the following:\n' +
      '  Element uses a positive tabindex value, disrupting the natural focus order.',
  },
};

/** Get a rule by ID, or throw if unknown. */
export function getRule(ruleId: string): OracleRule {
  const rule = RULES[ruleId];
  if (!rule) {
    throw new Error(`Unknown oracle rule: ${ruleId}`);
  }
  return rule;
}

/**
 * Map each WCAG standard to the set of rule-level tags it includes.
 *
 * Each standard includes all rules from earlier versions at the same
 * or lower conformance level. For example, `'wcag21aa'` includes
 * rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`.
 */
const STANDARD_TAG_MAP: Record<WcagLevel, ReadonlySet<string>> = {
  'wcag2a':   new Set(['wcag2a']),
  'wcag2aa':  new Set(['wcag2a', 'wcag2aa']),
  'wcag21a':  new Set(['wcag2a', 'wcag21a']),
  'wcag21aa': new Set(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']),
  'wcag22a':  new Set(['wcag2a', 'wcag21a', 'wcag22a']),
  'wcag22aa': new Set(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']),
};

/**
 * Check if a rule applies at the given WCAG standard.
 *
 * A rule matches if any of its tags appear in the set of tags
 * covered by the given standard. For example, a rule tagged
 * `wcag22aa` matches `'wcag22aa'` but not `'wcag21aa'`.
 */
export function matchesWcagLevel(rule: OracleRule, level: WcagLevel): boolean {
  const allowedTags = STANDARD_TAG_MAP[level];
  return rule.tags.some((tag) => allowedTags.has(tag));
}

/** All defined rule IDs. */
export const RULE_IDS = Object.keys(RULES);
