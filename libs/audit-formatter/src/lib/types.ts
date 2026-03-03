/**
 * @module types
 *
 * Axe-core-compatible issue types for A11y-Oracle findings.
 *
 * These types are structurally compatible with Beacon's AxeIssue interface
 * but defined locally so audit-formatter has zero dependencies on Beacon.
 *
 * Fields that Beacon assigns during ingestion (id, testRunId, fingerprint,
 * status, triageNotes) are omitted — the formatter only outputs the issue
 * data itself.
 */

/** Impact levels matching axe-core severity. */
export type OracleImpact = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * Result type discriminator.
 * - `'violation'` / `'incomplete'` match axe-core conventions.
 * - `'oracle'` identifies findings from A11y-Oracle analysis.
 */
export type OracleResultType = 'violation' | 'incomplete' | 'oracle';

/**
 * A single check within an axe-core node result.
 * Simplified for Oracle findings — `data` carries rule-specific context
 * (e.g., `{ contrastRatio: 2.1 }` for focus contrast issues).
 */
export interface OracleCheck {
  /** Check identifier (typically the ruleId). */
  id: string;
  /** Check-specific data, e.g. `{ contrastRatio: 2.1 }`. */
  data: unknown;
  /** Related DOM nodes (empty for Oracle findings). */
  relatedNodes: unknown[];
  /** Impact level of this check. */
  impact: string;
  /** Human-readable description of the check result. */
  message: string;
}

/**
 * A single DOM node result, compatible with axe-core's AxeNode shape.
 */
export interface OracleNode {
  /** Node-level impact override. */
  impact?: string;
  /** HTML snippet of the problematic element. */
  html: string;
  /** CSS selector path for the element. */
  target: string[];
  /** Checks where any one passing would fix the issue. */
  any: OracleCheck[];
  /** Checks where all must pass. */
  all: OracleCheck[];
  /** Checks where none should be present. */
  none: OracleCheck[];
  /** Human-readable summary of the failure. */
  failureSummary: string;
}

/**
 * An accessibility issue in axe-core-compatible format.
 *
 * Structurally compatible with Beacon's `AxeIssue` interface for the
 * fields that the formatter is responsible for producing. Fields assigned
 * by the consumer (id, testRunId, fingerprint, status, triageNotes)
 * are omitted.
 *
 * `resultType` is always `'oracle'` to distinguish from axe-core findings.
 * `ruleId` is prefixed with `oracle/` (e.g., `oracle/focus-not-visible`).
 */
export interface OracleIssue {
  /** Rule identifier, e.g. `oracle/focus-not-visible`. */
  ruleId: string;
  /** Severity: minor | moderate | serious | critical. */
  impact: OracleImpact;
  /** Human-readable description of what the rule checks. */
  description: string;
  /** Short help text for the issue. */
  help: string;
  /** Summary of the failure for remediation. */
  failureSummary: string;
  /** HTML snippet of the offending element. */
  htmlSnippet: string;
  /** CSS selector targeting the element. */
  selector: string;
  /** Name of the test spec that produced this finding. */
  specName: string;
  /** Project name for issue attribution. */
  project: string;
  /** URL to WCAG documentation. */
  helpUrl: string;
  /** WCAG tags, e.g. `['wcag2a', 'wcag212', 'cat.keyboard', 'oracle']`. */
  tags: string[];
  /** Axe-compatible node results. */
  nodes: OracleNode[];
  /** Result type discriminator. Always `'oracle'` for formatter output. */
  resultType: OracleResultType;
}

/**
 * Context required by all formatter functions.
 * Provided by the test runner or OracleAuditor.
 */
export interface AuditContext {
  /** Project name for issue attribution. */
  project: string;
  /** Name of the spec/test file producing these findings. */
  specName: string;
}

/**
 * Metadata for a single Oracle audit rule.
 */
export interface OracleRule {
  /** Rule ID, e.g. `oracle/focus-not-visible`. */
  ruleId: string;
  /** Short help text, used as the issue `help` field. */
  help: string;
  /** Longer description, used as the issue `description` field. */
  description: string;
  /** Impact severity. */
  impact: OracleImpact;
  /** WCAG tags. */
  tags: string[];
  /** URL to WCAG criterion documentation. */
  helpUrl: string;
  /** Failure summary template. */
  failureSummary: string;
}
