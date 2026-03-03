/**
 * @module @a11y-oracle/audit-formatter
 *
 * Converts A11y-Oracle findings into axe-core-compatible issues.
 *
 * Output is structurally compatible with Beacon's AxeIssue interface,
 * differentiated by `resultType: 'oracle'` and `oracle/`-prefixed ruleIds.
 *
 * @packageDocumentation
 */

// Types
export type {
  OracleIssue,
  OracleNode,
  OracleCheck,
  OracleImpact,
  OracleResultType,
  OracleRule,
  AuditContext,
  WcagLevel,
} from './lib/types.js';

// Rule definitions
export { RULES, RULE_IDS, getRule, matchesWcagLevel } from './lib/rules.js';

// Pure formatter functions
export {
  formatFocusIssues,
  formatTrapIssue,
  formatNameIssues,
  formatRoleIssues,
  formatTabIndexIssues,
  formatAllIssues,
} from './lib/formatters.js';

// Selector utilities
export {
  selectorFromFocusedElement,
  selectorFromTabOrderEntry,
  htmlSnippetFromFocusedElement,
  htmlSnippetFromTabOrderEntry,
} from './lib/selector.js';

// Convenience class
export { OracleAuditor } from './lib/oracle-auditor.js';
export type { OrchestratorLike } from './lib/oracle-auditor.js';
