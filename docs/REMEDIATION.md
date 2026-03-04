# A11y-Oracle Remediation Guide

A11y-Oracle enforces six keyboard and focus accessibility rules derived from WCAG 2.2. When a rule fails, it produces an `OracleIssue` object with an `oracle/`-prefixed `ruleId` and `resultType: 'oracle'`.

This guide provides an overview of each rule, with detailed remediation guidance linked from the table below.

## Rules

| Rule ID | WCAG Criterion | Since | Level | Tag | Impact | Description | Guide |
|---------|---------------|-------|-------|-----|--------|-------------|-------|
| `oracle/focus-not-visible` | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | 2.0 | AA | `wcag2aa` | `serious` | Focused element has no visible focus indicator | [Remediation](./rules/focus-not-visible.md) |
| `oracle/focus-low-contrast` | [2.4.12 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | 2.2 | AA | `wcag22aa` | `moderate` | Focus indicator contrast ratio is below 3:1 | [Remediation](./rules/focus-low-contrast.md) |
| `oracle/keyboard-trap` | [2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html) | 2.0 | A | `wcag2a` | `critical` | Keyboard focus is trapped within a container | [Remediation](./rules/keyboard-trap.md) |
| `oracle/focus-missing-name` | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | 2.0 | A | `wcag2a` | `serious` | Focused element has no accessible name | [Remediation](./rules/focus-missing-name.md) |
| `oracle/focus-generic-role` | [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) | 2.0 | A | `wcag2a` | `serious` | Focused element has a generic or presentational role | [Remediation](./rules/focus-generic-role.md) |
| `oracle/positive-tabindex` | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | 2.0 | A | `wcag2a` | `serious` | Element uses a positive tabindex value | [Remediation](./rules/positive-tabindex.md) |

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

## Configuring WCAG Level

By default, A11y-Oracle enforces all rules at `'wcag22aa'` (WCAG 2.2 Level AA). You can target a specific WCAG version and level via `AuditContext`:

```typescript
// Playwright — OracleAuditor
const auditor = new OracleAuditor(a11y, {
  project: 'my-app',
  specName: 'test.ts',
  wcagLevel: 'wcag22a',  // WCAG 2.2 Level A only (excludes AA rules)
});

// Cypress — env variable
// cypress.config.ts
env: { wcagLevel: 'wcag21aa' }  // WCAG 2.1 Level AA (excludes WCAG 2.2-only rules)
```

Supported values (matching axe-core tag convention):

| Value | Includes |
|-------|----------|
| `'wcag2a'` | WCAG 2.0 Level A |
| `'wcag2aa'` | WCAG 2.0 Level A + AA |
| `'wcag21a'` | WCAG 2.0 A + 2.1 A |
| `'wcag21aa'` | WCAG 2.0 A + AA, 2.1 A + AA |
| `'wcag22a'` | WCAG 2.0 A, 2.1 A, 2.2 A |
| `'wcag22aa'` | All rules (default) |

To suppress specific rules, use `disabledRules`:

```typescript
const auditor = new OracleAuditor(a11y, {
  project: 'my-app',
  specName: 'test.ts',
  disabledRules: ['oracle/positive-tabindex'],
});
```

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

---

## Resolving Incomplete Color Contrast

axe-core flags text over gradients, background images, and complex CSS as "incomplete" because it cannot determine the actual background color from CSS alone. The `@a11y-oracle/axe-bridge` package resolves these warnings using visual analysis.

### How It Works

Call `resolveIncompleteContrast()` immediately after `axe.run()` while the page is still live and the CDP session is available:

```typescript
import { resolveIncompleteContrast } from '@a11y-oracle/axe-bridge';

// Run axe-core
const axeResults = await axe.run(document);

// Resolve incomplete color-contrast warnings
const resolved = await resolveIncompleteContrast(cdpSession, axeResults);

// Assert on resolved results
expect(resolved.violations).toHaveLength(0);
```

The bridge analyzes each incomplete `color-contrast` node through a two-stage pipeline:

1. **CSS Halo Check** (fast path) — Detects `-webkit-text-stroke` or multi-directional `text-shadow` that guarantees text readability without needing a screenshot.

2. **Pixel Analysis** (fallback) — Captures a screenshot of the element's background with text hidden, scans for the lightest and darkest pixels, and applies the WCAG Safe Assessment Matrix:
   - **Pass**: Worst-case contrast (against lightest background) meets threshold
   - **Violation**: Best-case contrast (against darkest background) fails threshold
   - **Incomplete**: Split decision — one extreme passes, the other fails

### Large Text

The bridge automatically detects large text from axe-core's check metadata and applies the WCAG reduced threshold of 3.0:1 (instead of 4.5:1) for text >= 24px or bold text >= 18.66px.

See the [@a11y-oracle/axe-bridge README](../libs/axe-bridge/README.md) and [@a11y-oracle/visual-engine README](../libs/visual-engine/README.md) for full API details.
