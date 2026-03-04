/**
 * @module resolver-pipeline
 *
 * Shared utilities for axe-core incomplete rule resolvers.
 * Provides the common clone → find-rule → analyze → promote → return
 * pipeline that every resolver follows.
 */

import type { AxeResults, AxeRule, AxeNode } from './types.js';

/**
 * Extract the innermost CSS selector from an axe node's target.
 *
 * axe-core represents selectors as arrays where shadow DOM targets
 * have multiple entries. We use the last (innermost) selector.
 */
export function getSelector(node: AxeNode): string {
  return node.target[node.target.length - 1] ?? '';
}

/**
 * Deep-clone an AxeResults object to avoid mutating the original.
 */
export function cloneResults(results: AxeResults): AxeResults {
  return JSON.parse(JSON.stringify(results));
}

/**
 * Create a rule shell (all metadata, no nodes) from an existing rule.
 */
export function ruleShell(rule: AxeRule): AxeRule {
  return {
    id: rule.id,
    impact: rule.impact,
    tags: [...rule.tags],
    description: rule.description,
    help: rule.help,
    helpUrl: rule.helpUrl,
    nodes: [],
  };
}

/** Categorized node results from a resolver's analysis phase. */
export interface PromotionResult {
  passNodes: AxeNode[];
  violationNodes: AxeNode[];
  incompleteNodes: AxeNode[];
}

/**
 * Apply node promotions to a cloned AxeResults object.
 *
 * Moves nodes from the incomplete rule entry into the passes and
 * violations arrays, then updates or removes the incomplete entry.
 *
 * @param clone - The cloned AxeResults to mutate.
 * @param ruleIndex - Index of the rule in `clone.incomplete`.
 * @param rule - The incomplete rule being resolved.
 * @param result - Categorized nodes from the resolver's analysis.
 */
export function applyPromotions(
  clone: AxeResults,
  ruleIndex: number,
  rule: AxeRule,
  result: PromotionResult,
): void {
  const ruleId = rule.id;

  // Promote violations
  if (result.violationNodes.length > 0) {
    const existing = clone.violations.find((r) => r.id === ruleId);
    if (existing) {
      existing.nodes.push(...result.violationNodes);
    } else {
      clone.violations.push({
        ...ruleShell(rule),
        nodes: result.violationNodes,
      });
    }
  }

  // Promote passes
  if (result.passNodes.length > 0) {
    const existing = clone.passes.find((r) => r.id === ruleId);
    if (existing) {
      existing.nodes.push(...result.passNodes);
    } else {
      clone.passes.push({
        ...ruleShell(rule),
        nodes: result.passNodes,
      });
    }
  }

  // Update or remove the incomplete entry
  if (result.incompleteNodes.length > 0) {
    rule.nodes = result.incompleteNodes;
  } else {
    clone.incomplete.splice(ruleIndex, 1);
  }
}

/**
 * Find a rule by ID in the incomplete array.
 *
 * @returns The rule index and rule object, or null if not found.
 */
export function findIncompleteRule(
  clone: AxeResults,
  ruleId: string,
): { index: number; rule: AxeRule } | null {
  const index = clone.incomplete.findIndex((r) => r.id === ruleId);
  if (index === -1) return null;
  return { index, rule: clone.incomplete[index] };
}
