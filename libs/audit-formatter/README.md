# @a11y-oracle/audit-formatter

Converts A11y-Oracle findings into axe-core-compatible issue objects (`OracleIssue`). Pure functions with no CDP dependency — works with any `A11yState` or `TraversalResult` regardless of how it was produced.

Output is differentiated from axe-core findings by `resultType: 'oracle'` and `oracle/`-prefixed rule IDs (e.g., `oracle/focus-not-visible`).

## Installation

```bash
npm install @a11y-oracle/audit-formatter
```

> **Note:** Most users should use the [`@a11y-oracle/playwright-plugin`](../playwright-plugin/README.md) or [`@a11y-oracle/cypress-plugin`](../cypress-plugin/README.md) instead. The audit-formatter is the underlying library that those plugins use. Install it directly if you need to format issues outside a test framework or build a custom integration.

## Usage

### Pure Formatter Functions

The simplest approach — pass an `A11yState` and get back any issues:

```typescript
import { formatFocusIssues, formatTrapIssue } from '@a11y-oracle/audit-formatter';
import type { A11yState } from '@a11y-oracle/core-engine';
import type { TraversalResult } from '@a11y-oracle/focus-analyzer';

const context = { project: 'my-app', specName: 'nav.spec.ts' };

// Check a focused element for focus indicator issues
const focusIssues = formatFocusIssues(state, context);
// Returns: [] if passing, or [OracleIssue] if failing

// Check a traversal result for keyboard traps
const trapIssues = formatTrapIssue(result, '#modal-container', context);
// Returns: [] if not trapped, or [OracleIssue] if trapped

// Convenience: run all state-based checks at once
import { formatAllIssues } from '@a11y-oracle/audit-formatter';
const allIssues = formatAllIssues(state, context);
```

### OracleAuditor Class

Wraps an orchestrator and automatically audits every interaction. Issues accumulate across calls:

```typescript
import { test, expect } from '@a11y-oracle/playwright-plugin';
import { OracleAuditor } from '@a11y-oracle/audit-formatter';

test('all focus indicators pass oracle rules', async ({ page, a11y }) => {
  await page.goto('/my-page.html');

  const auditor = new OracleAuditor(a11y, {
    project: 'my-app',
    specName: 'navigation.spec.ts',
  });

  // Each pressKey() automatically runs all state-based checks
  await auditor.pressKey('Tab');
  await auditor.pressKey('Tab');
  await auditor.pressKey('Tab');

  // Check a container for keyboard traps
  await auditor.checkTrap('#modal-container');

  // Assert no issues found
  expect(auditor.issueCount).toBe(0);
  expect(auditor.getIssues()).toHaveLength(0);
});
```

The `OracleAuditor` accepts any object matching the `OrchestratorLike` interface, which is satisfied by both `A11yOracle` (Playwright) and `A11yOrchestrator` (core engine).

### Selector Utilities

Generate CSS selectors and HTML snippets from element data:

```typescript
import {
  selectorFromFocusedElement,
  htmlSnippetFromFocusedElement,
} from '@a11y-oracle/audit-formatter';

const selector = selectorFromFocusedElement(state.focusedElement);
// "#submit-btn" or "button.primary.large" or "button"

const snippet = htmlSnippetFromFocusedElement(state.focusedElement);
// '<button id="submit-btn" class="primary">Submit</button>'
```

## Rules

A11y-Oracle enforces six WCAG rules:

| Rule ID | WCAG Criterion | Since | Level | Tag | Impact | Description |
|---------|---------------|-------|-------|-----|--------|-------------|
| `oracle/focus-not-visible` | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | 2.0 | AA | `wcag2aa` | `serious` | Focused element has no visible focus indicator |
| `oracle/focus-low-contrast` | [2.4.12 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | 2.2 | AA | `wcag22aa` | `moderate` | Focus indicator contrast ratio is below 3:1 |
| `oracle/keyboard-trap` | [2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html) | 2.0 | A | `wcag2a` | `critical` | Keyboard focus is trapped within a container |
| `oracle/focus-missing-name` | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | 2.0 | A | `wcag2a` | `serious` | Focused element has no accessible name |
| `oracle/focus-generic-role` | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | 2.0 | A | `wcag2a` | `serious` | Focused element has a generic or presentational role |
| `oracle/positive-tabindex` | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | 2.0 | A | `wcag2a` | `serious` | Element uses a positive tabindex value |

`focus-not-visible` takes priority over `focus-low-contrast` — if no indicator exists, only the visibility rule fires (not both). `focus-generic-role` and `focus-missing-name` are mutually exclusive — generic roles trigger only the role check.

For detailed remediation guidance on each rule, see the [Remediation Guide](../../docs/REMEDIATION.md).

## API Reference

### Formatter Functions

#### `formatFocusIssues(state, context)`

Check an `A11yState` for focus indicator issues.

- **Parameters:**
  - `state: A11yState` — unified accessibility state from `pressKey()` or `getState()`
  - `context: AuditContext` — `{ project, specName, wcagLevel?, disabledRules? }`
- **Returns:** `OracleIssue[]` — 0 or 1 issues
- **Behavior:** Returns `oracle/focus-not-visible` if `isVisible === false`. Returns `oracle/focus-low-contrast` if visible but `meetsWCAG_AA === false`. Returns `[]` if passing or no focused element.

#### `formatTrapIssue(result, containerSelector, context)`

Check a `TraversalResult` for keyboard traps.

- **Parameters:**
  - `result: TraversalResult` — result from `traverseSubTree()`
  - `containerSelector: string` — CSS selector for the container (used in the issue)
  - `context: AuditContext` — `{ project: string, specName: string }`
- **Returns:** `OracleIssue[]` — 0 or 1 issues

#### `formatNameIssues(state, context)`

Check an `A11yState` for missing accessible name issues.

- **Parameters:** Same as `formatFocusIssues`
- **Returns:** `OracleIssue[]` — 0 or 1 issues
- **Behavior:** Returns `oracle/focus-missing-name` if the focused element has no computed name. Skips elements with generic/presentational roles (those fire `formatRoleIssues` instead).

#### `formatRoleIssues(state, context)`

Check an `A11yState` for generic/presentational role issues.

- **Parameters:** Same as `formatFocusIssues`
- **Returns:** `OracleIssue[]` — 0 or 1 issues
- **Behavior:** Returns `oracle/focus-generic-role` if the focused element has a `generic`, `none`, or `presentation` role.

#### `formatTabIndexIssues(state, context)`

Check an `A11yState` for positive tabindex issues.

- **Parameters:** Same as `formatFocusIssues`
- **Returns:** `OracleIssue[]` — 0 or 1 issues
- **Behavior:** Returns `oracle/positive-tabindex` if the focused element has `tabIndex > 0`.

#### `formatAllIssues(state, context)`

Convenience wrapper that runs all state-based checks: focus indicator, name, role, and tabindex.

- **Parameters:** Same as `formatFocusIssues`
- **Returns:** `OracleIssue[]`
- **Behavior:** Applies `wcagLevel` filtering (default `'aa'`) and `disabledRules` suppression from `context`.

#### `matchesWcagLevel(rule, level)`

Check if a rule applies at a given WCAG conformance level.

- **Parameters:**
  - `rule: OracleRule` — rule metadata object
  - `level: WcagLevel` — `'a'` or `'aa'`
- **Returns:** `boolean` — `true` if the rule applies at the given level
- **Behavior:** `'aa'` includes all rules. `'a'` includes only rules tagged with `wcag2a`.

### OracleAuditor

#### `constructor(orchestrator, context)`

- `orchestrator: OrchestratorLike` — any object with `pressKey()`, `getState()`, and `traverseSubTree()` methods
- `context: AuditContext` — `{ project, specName, wcagLevel?, disabledRules? }`

#### `pressKey(key, modifiers?): Promise<A11yState>`

Dispatch a key press and automatically audit the resulting state for all state-based rules.

#### `getState(): Promise<A11yState>`

Read the current state and audit it for all state-based rules.

#### `checkTrap(selector, maxTabs?): Promise<TraversalResult>`

Run keyboard trap detection on a container and audit the result.

#### `getIssues(): ReadonlyArray<OracleIssue>`

Return a copy of all accumulated issues.

#### `clear(): void`

Reset the accumulated issues list.

#### `issueCount: number`

The number of accumulated issues (getter).

### OrchestratorLike Interface

```typescript
interface OrchestratorLike {
  pressKey(key: string, modifiers?: Record<string, boolean>): Promise<A11yState>;
  getState(): Promise<A11yState>;
  traverseSubTree(selector: string, maxTabs?: number): Promise<TraversalResult>;
}
```

Satisfied by `A11yOracle` (playwright-plugin) and `A11yOrchestrator` (core-engine).

### Rule Utilities

#### `RULES: Record<string, OracleRule>`

All defined rule objects keyed by rule ID.

#### `RULE_IDS: string[]`

Array of all rule IDs.

#### `getRule(ruleId): OracleRule`

Get a rule by ID, or throw if unknown.

### Selector Utilities

#### `selectorFromFocusedElement(el): string`

Generate a CSS selector from an `A11yFocusedElement`. Priority: `#id` > `tag.class1.class2` > `tag`.

#### `selectorFromTabOrderEntry(entry): string`

Generate a CSS selector from a `TabOrderEntry`. Priority: `#id` > `tag[role="..."]` > `tag`.

#### `htmlSnippetFromFocusedElement(el): string`

Generate a minimal HTML snippet from an `A11yFocusedElement`.

#### `htmlSnippetFromTabOrderEntry(entry): string`

Generate a minimal HTML snippet from a `TabOrderEntry`.

## Types

```typescript
import type {
  OracleIssue,         // Main issue object
  OracleNode,          // Axe-compatible node result
  OracleCheck,         // Individual check within a node
  OracleImpact,        // 'minor' | 'moderate' | 'serious' | 'critical'
  OracleResultType,    // 'violation' | 'incomplete' | 'oracle'
  OracleRule,          // Rule metadata
  AuditContext,        // { project, specName, wcagLevel?, disabledRules? }
  WcagLevel,           // 'wcag2a' | 'wcag2aa' | 'wcag21a' | 'wcag21aa' | 'wcag22a' | 'wcag22aa'
} from '@a11y-oracle/audit-formatter';
```

## Exports

```typescript
// Types
export type { OracleIssue, OracleNode, OracleCheck, OracleImpact, OracleResultType, OracleRule, AuditContext, WcagLevel };

// Rule definitions
export { RULES, RULE_IDS, getRule, matchesWcagLevel };

// Pure formatter functions
export { formatFocusIssues, formatTrapIssue, formatNameIssues, formatRoleIssues, formatTabIndexIssues, formatAllIssues };

// Selector utilities
export { selectorFromFocusedElement, selectorFromTabOrderEntry, htmlSnippetFromFocusedElement, htmlSnippetFromTabOrderEntry };

// Convenience class
export { OracleAuditor };
export type { OrchestratorLike };
```
