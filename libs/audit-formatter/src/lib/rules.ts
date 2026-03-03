/**
 * @module rules
 *
 * Oracle audit rule definitions with WCAG metadata.
 *
 * Each rule maps to a specific WCAG criterion and carries all the metadata
 * needed to produce a fully populated OracleIssue. Rules are keyed by their
 * `ruleId` (e.g., `oracle/focus-not-visible`).
 */

import type { OracleRule } from './types.js';

/**
 * All defined Oracle audit rules.
 *
 * - `oracle/focus-not-visible` — WCAG 2.4.7 Focus Visible (Level AA)
 * - `oracle/focus-low-contrast` — WCAG 2.4.12 Focus Appearance (Level AA, WCAG 2.2)
 * - `oracle/keyboard-trap` — WCAG 2.1.2 No Keyboard Trap (Level A)
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
    tags: ['wcag2aa', 'wcag2412', 'cat.keyboard', 'oracle'],
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
};

/** Get a rule by ID, or throw if unknown. */
export function getRule(ruleId: string): OracleRule {
  const rule = RULES[ruleId];
  if (!rule) {
    throw new Error(`Unknown oracle rule: ${ruleId}`);
  }
  return rule;
}

/** All defined rule IDs. */
export const RULE_IDS = Object.keys(RULES);
