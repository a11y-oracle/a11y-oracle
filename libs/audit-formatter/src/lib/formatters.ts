/**
 * @module formatters
 *
 * Pure functions that convert A11y-Oracle data into OracleIssue objects.
 *
 * Each function takes A11y-Oracle findings + an AuditContext and returns
 * an array of OracleIssue objects (empty if no issues found). The functions
 * have no side effects and do not require a CDP session or orchestrator.
 *
 * @example
 * ```typescript
 * import { formatFocusIssues } from '@a11y-oracle/audit-formatter';
 *
 * const state = await a11y.pressKey('Tab');
 * const issues = formatFocusIssues(state, { project: 'my-app', specName: 'nav.spec.ts' });
 * expect(issues).toHaveLength(0); // No focus issues
 * ```
 */

import type {
  A11yState,
  A11yFocusedElement,
} from '@a11y-oracle/core-engine';
import type { TraversalResult } from '@a11y-oracle/focus-analyzer';
import type {
  OracleIssue,
  OracleNode,
  AuditContext,
} from './types.js';
import { RULES, matchesWcagLevel } from './rules.js';
import {
  selectorFromFocusedElement,
  selectorFromTabOrderEntry,
  htmlSnippetFromFocusedElement,
  htmlSnippetFromTabOrderEntry,
} from './selector.js';

/**
 * Analyze an A11yState for focus-related issues.
 *
 * Checks two rules (only one fires per state — `focus-not-visible` takes priority):
 * - `oracle/focus-not-visible` — `focusIndicator.isVisible === false`
 * - `oracle/focus-low-contrast` — `isVisible` but `meetsWCAG_AA === false`
 *
 * Returns an empty array if no element is focused or focus indicator passes.
 *
 * @param state - Unified accessibility state from pressKey() or getState()
 * @param context - Audit context (project, specName)
 * @returns Array of 0 or 1 OracleIssue
 */
export function formatFocusIssues(
  state: A11yState,
  context: AuditContext
): OracleIssue[] {
  if (!state.focusedElement) {
    return [];
  }

  const el = state.focusedElement;
  const indicator = state.focusIndicator;

  // focus-not-visible takes priority over focus-low-contrast
  if (!indicator.isVisible) {
    return [
      buildFocusIssue(
        'oracle/focus-not-visible',
        el,
        indicator.contrastRatio,
        context
      ),
    ];
  }

  if (!indicator.meetsWCAG_AA) {
    return [
      buildFocusIssue(
        'oracle/focus-low-contrast',
        el,
        indicator.contrastRatio,
        context
      ),
    ];
  }

  return [];
}

/**
 * Analyze a TraversalResult for keyboard trap issues.
 *
 * Checks:
 * - `oracle/keyboard-trap` — `isTrapped === true`
 *
 * @param result - Traversal result from traverseSubTree()
 * @param containerSelector - The CSS selector of the container tested for trapping
 * @param context - Audit context
 * @returns Array of 0 or 1 OracleIssue
 */
export function formatTrapIssue(
  result: TraversalResult,
  containerSelector: string,
  context: AuditContext
): OracleIssue[] {
  if (!result.isTrapped) {
    return [];
  }

  const rule = RULES['oracle/keyboard-trap'];

  // Build node entries from visited elements
  const nodeEntries: OracleNode[] = result.visitedElements.map((entry) => ({
    impact: rule.impact,
    html: htmlSnippetFromTabOrderEntry(entry),
    target: [selectorFromTabOrderEntry(entry)],
    any: [],
    all: [],
    none: [
      {
        id: rule.ruleId,
        data: null,
        relatedNodes: [],
        impact: rule.impact,
        message: `Element is trapped inside ${containerSelector} (${result.tabCount} tabs attempted)`,
      },
    ],
    failureSummary: rule.failureSummary,
  }));

  // If no visited elements, create a single node for the container
  if (nodeEntries.length === 0) {
    nodeEntries.push({
      impact: rule.impact,
      html: `<div><!-- container: ${containerSelector} --></div>`,
      target: [containerSelector],
      any: [],
      all: [],
      none: [
        {
          id: rule.ruleId,
          data: null,
          relatedNodes: [],
          impact: rule.impact,
          message: `Keyboard focus is trapped within ${containerSelector}`,
        },
      ],
      failureSummary: rule.failureSummary,
    });
  }

  return [
    {
      ruleId: rule.ruleId,
      impact: rule.impact,
      description: rule.description,
      help: rule.help,
      failureSummary: rule.failureSummary,
      htmlSnippet: nodeEntries[0].html,
      selector: containerSelector,
      specName: context.specName,
      project: context.project,
      helpUrl: rule.helpUrl,
      tags: [...rule.tags],
      nodes: nodeEntries,
      resultType: 'oracle',
    },
  ];
}

/** Roles that provide no semantic information to assistive technologies. */
const GENERIC_ROLES = new Set([
  'generic',
  'none',
  'presentation',
  '',
]);

/**
 * Analyze an A11yState for missing accessible name issues.
 *
 * Checks:
 * - `oracle/focus-missing-name` — focused element has no computed name
 *
 * Only fires when an element is focused AND has a meaningful role
 * (elements with generic/none/presentation roles fire
 * `oracle/focus-generic-role` instead).
 *
 * @param state - Unified accessibility state from pressKey() or getState()
 * @param context - Audit context (project, specName)
 * @returns Array of 0 or 1 OracleIssue
 */
export function formatNameIssues(
  state: A11yState,
  context: AuditContext
): OracleIssue[] {
  if (!state.focusedElement || !state.speechResult) {
    return [];
  }

  // Only check elements with meaningful roles — generic/none handled separately
  const rawRole = state.speechResult.rawNode?.role?.value ?? '';
  if (GENERIC_ROLES.has(rawRole)) {
    return [];
  }

  // Check if the computed name is empty
  if (state.speechResult.name && state.speechResult.name.trim() !== '') {
    return [];
  }

  return [buildElementIssue('oracle/focus-missing-name', state.focusedElement, null, context)];
}

/**
 * Analyze an A11yState for generic/presentational role issues.
 *
 * Checks:
 * - `oracle/focus-generic-role` — focused element has generic, none, or
 *   presentation role
 *
 * Only fires when an element is focused AND the AXNode role is one of the
 * semantically empty roles. This indicates an element that receives keyboard
 * focus but provides no role information to assistive technologies.
 *
 * @param state - Unified accessibility state from pressKey() or getState()
 * @param context - Audit context (project, specName)
 * @returns Array of 0 or 1 OracleIssue
 */
export function formatRoleIssues(
  state: A11yState,
  context: AuditContext
): OracleIssue[] {
  if (!state.focusedElement || !state.speechResult) {
    return [];
  }

  const rawRole = state.speechResult.rawNode?.role?.value ?? '';
  if (rawRole === '' || !GENERIC_ROLES.has(rawRole)) {
    return [];
  }

  return [
    buildElementIssue(
      'oracle/focus-generic-role',
      state.focusedElement,
      { role: rawRole },
      context
    ),
  ];
}

/**
 * Analyze an A11yState for positive tabindex issues.
 *
 * Checks:
 * - `oracle/positive-tabindex` — focused element has `tabIndex > 0`
 *
 * Positive tabindex values create an unpredictable focus order that
 * diverges from the visual reading order.
 *
 * @param state - Unified accessibility state from pressKey() or getState()
 * @param context - Audit context (project, specName)
 * @returns Array of 0 or 1 OracleIssue
 */
export function formatTabIndexIssues(
  state: A11yState,
  context: AuditContext
): OracleIssue[] {
  if (!state.focusedElement) {
    return [];
  }

  if (state.focusedElement.tabIndex <= 0) {
    return [];
  }

  return [
    buildElementIssue(
      'oracle/positive-tabindex',
      state.focusedElement,
      { tabIndex: state.focusedElement.tabIndex },
      context
    ),
  ];
}

/**
 * Convenience: analyze an A11yState for ALL state-based rules.
 *
 * Runs focus indicator checks, name/role checks, and tabindex checks.
 * Trap detection requires a separate TraversalResult — use
 * `formatTrapIssue()` for that.
 *
 * @param state - Unified accessibility state
 * @param context - Audit context
 * @returns Array of OracleIssue objects
 */
export function formatAllIssues(
  state: A11yState,
  context: AuditContext
): OracleIssue[] {
  const level = context.wcagLevel ?? 'wcag22aa';
  const disabledSet = context.disabledRules
    ? new Set(context.disabledRules)
    : null;

  const allIssues = [
    ...formatFocusIssues(state, context),
    ...formatNameIssues(state, context),
    ...formatRoleIssues(state, context),
    ...formatTabIndexIssues(state, context),
  ];

  return allIssues.filter((issue) => {
    if (disabledSet?.has(issue.ruleId)) return false;
    return matchesWcagLevel(RULES[issue.ruleId], level);
  });
}

// ---- Internal helpers ----

function buildElementIssue(
  ruleId: string,
  el: A11yFocusedElement,
  data: unknown,
  context: AuditContext
): OracleIssue {
  const rule = RULES[ruleId];
  const selector = selectorFromFocusedElement(el);
  const html = htmlSnippetFromFocusedElement(el);

  const node: OracleNode = {
    impact: rule.impact,
    html,
    target: [selector],
    any: [],
    all: [],
    none: [
      {
        id: ruleId,
        data,
        relatedNodes: [],
        impact: rule.impact,
        message: rule.help,
      },
    ],
    failureSummary: rule.failureSummary,
  };

  return {
    ruleId,
    impact: rule.impact,
    description: rule.description,
    help: rule.help,
    failureSummary: rule.failureSummary,
    htmlSnippet: html,
    selector,
    specName: context.specName,
    project: context.project,
    helpUrl: rule.helpUrl,
    tags: [...rule.tags],
    nodes: [node],
    resultType: 'oracle',
  };
}

function buildFocusIssue(
  ruleId: string,
  el: A11yFocusedElement,
  contrastRatio: number | null,
  context: AuditContext
): OracleIssue {
  const rule = RULES[ruleId];
  const selector = selectorFromFocusedElement(el);
  const html = htmlSnippetFromFocusedElement(el);

  const contrastInfo =
    contrastRatio !== null
      ? ` (contrast ratio: ${contrastRatio.toFixed(2)}:1)`
      : '';

  const node: OracleNode = {
    impact: rule.impact,
    html,
    target: [selector],
    any: [],
    all: [],
    none: [
      {
        id: ruleId,
        data: contrastRatio !== null ? { contrastRatio } : null,
        relatedNodes: [],
        impact: rule.impact,
        message: `${rule.help}${contrastInfo}`,
      },
    ],
    failureSummary: rule.failureSummary,
  };

  return {
    ruleId,
    impact: rule.impact,
    description: rule.description,
    help: rule.help,
    failureSummary: rule.failureSummary,
    htmlSnippet: html,
    selector,
    specName: context.specName,
    project: context.project,
    helpUrl: rule.helpUrl,
    tags: [...rule.tags],
    nodes: [node],
    resultType: 'oracle',
  };
}
