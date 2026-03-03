/**
 * @module oracle-auditor
 *
 * Convenience wrapper that wraps an orchestrator-like object and
 * automatically audits each interaction for accessibility issues.
 *
 * @example
 * ```typescript
 * // Playwright
 * const auditor = new OracleAuditor(a11y, {
 *   project: 'my-app',
 *   specName: 'nav.spec.ts',
 * });
 * await auditor.pressKey('Tab');
 * await auditor.pressKey('Tab');
 * await auditor.checkTrap('#modal');
 * const issues = auditor.getIssues();
 * ```
 */

import type { A11yState } from '@a11y-oracle/core-engine';
import type { TraversalResult } from '@a11y-oracle/focus-analyzer';
import type { OracleIssue, AuditContext } from './types.js';
import { formatAllIssues, formatTrapIssue } from './formatters.js';

/**
 * Minimal interface satisfied by A11yOrchestrator and A11yOracle.
 *
 * Defined locally so the audit-formatter doesn't require a hard
 * dependency on any specific orchestrator implementation.
 */
export interface OrchestratorLike {
  pressKey(
    key: string,
    modifiers?: Record<string, boolean>
  ): Promise<A11yState>;
  getState(): Promise<A11yState>;
  traverseSubTree(
    selector: string,
    maxTabs?: number
  ): Promise<TraversalResult>;
}

/**
 * Convenience wrapper that accumulates Oracle issues across multiple
 * keyboard interactions and trap checks.
 *
 * Each call to `pressKey()`, `getState()`, or `checkTrap()` automatically
 * runs the relevant audit rules and accumulates any issues found. Call
 * `getIssues()` at the end to retrieve all accumulated issues.
 */
export class OracleAuditor {
  private orchestrator: OrchestratorLike;
  private context: AuditContext;
  private issues: OracleIssue[] = [];

  constructor(orchestrator: OrchestratorLike, context: AuditContext) {
    this.orchestrator = orchestrator;
    this.context = context;
  }

  /**
   * Press a key via the orchestrator and analyze the resulting state
   * for focus issues. Returns the A11yState for further assertions.
   */
  async pressKey(
    key: string,
    modifiers?: Record<string, boolean>
  ): Promise<A11yState> {
    const state = await this.orchestrator.pressKey(key, modifiers);
    this.issues.push(...formatAllIssues(state, this.context));
    return state;
  }

  /**
   * Get the current state and analyze it for focus issues.
   * Useful after programmatic focus changes or click handlers.
   */
  async getState(): Promise<A11yState> {
    const state = await this.orchestrator.getState();
    this.issues.push(...formatAllIssues(state, this.context));
    return state;
  }

  /**
   * Check a container for keyboard traps (WCAG 2.1.2).
   */
  async checkTrap(
    selector: string,
    maxTabs?: number
  ): Promise<TraversalResult> {
    const result = await this.orchestrator.traverseSubTree(
      selector,
      maxTabs
    );
    this.issues.push(
      ...formatTrapIssue(result, selector, this.context)
    );
    return result;
  }

  /**
   * Return all issues accumulated during the session.
   * Does not clear the internal list — call `clear()` to reset.
   */
  getIssues(): ReadonlyArray<OracleIssue> {
    return [...this.issues];
  }

  /**
   * Clear all accumulated issues.
   */
  clear(): void {
    this.issues = [];
  }

  /**
   * The number of accumulated issues.
   */
  get issueCount(): number {
    return this.issues.length;
  }
}
