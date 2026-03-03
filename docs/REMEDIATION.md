# A11y-Oracle Remediation Guide

A11y-Oracle enforces six keyboard and focus accessibility rules derived from WCAG 2.2. When a rule fails, it produces an `OracleIssue` object with an `oracle/`-prefixed `ruleId` and `resultType: 'oracle'`.

This guide provides an overview of each rule, with detailed remediation guidance linked from the table below.

## Rules

| Rule ID | WCAG Criterion | Level | Impact | Description | Guide |
|---------|---------------|-------|--------|-------------|-------|
| `oracle/focus-not-visible` | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | AA | `serious` | Focused element has no visible focus indicator | [Remediation](./rules/focus-not-visible.md) |
| `oracle/focus-low-contrast` | [2.4.12 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | AA | `moderate` | Focus indicator contrast ratio is below 3:1 | [Remediation](./rules/focus-low-contrast.md) |
| `oracle/keyboard-trap` | [2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html) | A | `critical` | Keyboard focus is trapped within a container | [Remediation](./rules/keyboard-trap.md) |
| `oracle/focus-missing-name` | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | A | `serious` | Focused element has no accessible name | [Remediation](./rules/focus-missing-name.md) |
| `oracle/focus-generic-role` | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | A | `serious` | Focused element has a generic or presentational role | [Remediation](./rules/focus-generic-role.md) |
| `oracle/positive-tabindex` | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | A | `serious` | Element uses a positive tabindex value | [Remediation](./rules/positive-tabindex.md) |

### Rule Categories

**Focus Indicator Rules** — Detect visual focus issues that sighted keyboard users encounter:
- [`oracle/focus-not-visible`](./rules/focus-not-visible.md) — No visible indicator at all
- [`oracle/focus-low-contrast`](./rules/focus-low-contrast.md) — Indicator exists but is hard to see

**Keyboard Navigation Rules** — Detect issues that affect keyboard-only and screen reader users:
- [`oracle/keyboard-trap`](./rules/keyboard-trap.md) — Focus cannot escape a container
- [`oracle/focus-missing-name`](./rules/focus-missing-name.md) — Element has no name for screen readers
- [`oracle/focus-generic-role`](./rules/focus-generic-role.md) — Element has no meaningful role
- [`oracle/positive-tabindex`](./rules/positive-tabindex.md) — Focus order is unpredictable

### Rule Interactions

- `focus-not-visible` takes priority over `focus-low-contrast` — if no indicator exists, only the visibility rule fires.
- `focus-generic-role` and `focus-missing-name` are mutually exclusive — elements with generic/presentational roles only trigger the role check, not the name check, since fixing the role is the higher priority.

---

## Using the Audit Tools

### Cypress

The Cypress plugin provides one-liner commands that check these rules and report issues:

```typescript
cy.a11yCheckFocusAndReport();                    // checks all state-based rules
cy.a11yCheckTrapAndReport('#modal', 10);         // checks keyboard-trap
```

See the [@a11y-oracle/cypress-plugin README](../libs/cypress-plugin/README.md) for setup and reporting configuration.

### Playwright

Use `OracleAuditor` from `@a11y-oracle/audit-formatter` to accumulate issues across interactions:

```typescript
import { OracleAuditor } from '@a11y-oracle/audit-formatter';

const auditor = new OracleAuditor(a11y, {
  project: 'my-app',
  specName: 'nav.spec.ts',
});

await auditor.pressKey('Tab');
await auditor.checkTrap('#modal');

expect(auditor.getIssues()).toHaveLength(0);
```

See the [@a11y-oracle/playwright-plugin README](../libs/playwright-plugin/README.md) for fixture setup.

### Direct Formatter Functions

For custom integrations, use the pure formatter functions from `@a11y-oracle/audit-formatter`:

```typescript
import {
  formatAllIssues,
  formatTrapIssue,
} from '@a11y-oracle/audit-formatter';

const allIssues = formatAllIssues(state, { project: 'my-app', specName: 'test.ts' });
const trapIssues = formatTrapIssue(result, '#container', { project: 'my-app', specName: 'test.ts' });
```

See the [@a11y-oracle/audit-formatter README](../libs/audit-formatter/README.md) for the full API.
