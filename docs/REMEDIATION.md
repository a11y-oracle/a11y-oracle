# A11y-Oracle Remediation Guide

A11y-Oracle enforces three keyboard and focus accessibility rules derived from WCAG 2.2. When a rule fails, it produces an `OracleIssue` object with an `oracle/`-prefixed `ruleId` and `resultType: 'oracle'`.

This guide explains each rule, what causes failures, and how to fix them.

---

## `oracle/focus-not-visible`

**WCAG 2.4.7 — Focus Visible (Level AA)** | Impact: `serious`

> Focused element must have a visible focus indicator.

### What It Checks

When an interactive element receives keyboard focus, A11y-Oracle inspects the element's computed CSS properties (`outline` and `box-shadow`) to determine whether a visible focus indicator exists. If no indicator is detected, the rule fails with `focusIndicator.isVisible === false`.

A missing focus indicator makes it impossible for keyboard users to know where they are on the page. This affects all sighted keyboard users, not just screen reader users.

### Common Causes

**CSS resets that remove outlines globally:**

```css
/* This removes ALL focus indicators — a major accessibility issue */
*:focus {
  outline: none;
}
```

Many CSS reset libraries (normalize.css, reset.css, or framework resets) remove the default browser outline without providing a replacement.

**Transparent or invisible outline colors:**

```css
button:focus {
  outline-color: transparent;
}
```

**Custom components styled only for mouse interaction:**

Some components apply visual feedback on `:hover` but not on `:focus` or `:focus-visible`, leaving keyboard users without any indicator.

**`outline: 0` without a replacement:**

```css
a:focus {
  outline: 0;
  /* No box-shadow or other replacement provided */
}
```

### How to Fix

**Use `:focus-visible` to show an outline for keyboard users:**

```css
/* Shows outline only for keyboard navigation, not mouse clicks */
button:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

`:focus-visible` is the recommended approach because it shows the indicator for keyboard users while hiding it for mouse users who don't need it.

**Provide `outline` or `box-shadow` on `:focus`:**

```css
/* If you need to support older browsers without :focus-visible */
a:focus {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

/* Alternative using box-shadow (useful when outline-radius isn't supported) */
button:focus {
  outline: none;
  box-shadow: 0 0 0 3px #005fcc;
}
```

**Audit reset stylesheets:**

Search your stylesheets for `outline: none` and `outline: 0`. For each occurrence, ensure a visible replacement is provided. If using a CSS framework, check whether it removes focus styles by default.

**Further reading:** [Understanding WCAG 2.4.7 — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

---

## `oracle/focus-low-contrast`

**WCAG 2.4.12 — Focus Appearance (Level AA, WCAG 2.2)** | Impact: `moderate`

> Focus indicator must have sufficient contrast (>= 3:1).

### What It Checks

When a focus indicator is visible, A11y-Oracle measures the contrast ratio between the indicator color (outline or box-shadow) and the element's background color. If the ratio is below 3:1, the rule fails with `focusIndicator.meetsWCAG_AA === false`.

The measured contrast ratio is available on `state.focusIndicator.contrastRatio` for debugging.

### Common Causes

**Light-colored outlines on light backgrounds:**

```css
/* #aaaaaa on white (#ffffff) = ~2.3:1 contrast — fails */
input:focus {
  outline: 2px solid #aaaaaa;
}
```

**Default browser outlines on light backgrounds:**

Some browsers use thin dotted outlines or light blue outlines that may not achieve 3:1 contrast on light backgrounds. While these pass `oracle/focus-not-visible` (the indicator exists), they fail `oracle/focus-low-contrast`.

**Box-shadow focus ring whose color is too close to the background:**

```css
/* Light blue shadow on white background may fail contrast check */
button:focus {
  box-shadow: 0 0 0 3px #99ccff;
}
```

### How to Fix

**Choose an outline color that achieves >= 3:1 contrast against the element's background:**

```css
/* #767676 on white = 4.5:1 contrast — passes */
input:focus-visible {
  outline: 2px solid #767676;
  outline-offset: 2px;
}

/* #005fcc on white = 7.2:1 contrast — passes easily */
button:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

**Use a contrast checker tool** to verify your outline color against the element's background:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessible Colors](https://accessible-colors.com/)
- Browser DevTools contrast inspection

**Use your design system's high-contrast token** if available. Most design systems define a focus ring color that meets contrast requirements across all surface colors.

**Consider dark backgrounds too:**

```css
/* On a dark background, use a light outline */
.dark-card input:focus-visible {
  outline: 3px solid #ffffff;
}
```

**Further reading:** [Understanding WCAG 2.4.12 — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)

---

## `oracle/keyboard-trap`

**WCAG 2.1.2 — No Keyboard Trap (Level A)** | Impact: `critical`

> Interactive content must not trap keyboard focus.

### What It Checks

A11y-Oracle focuses the first element inside a container, then presses Tab repeatedly (up to `maxTabs` times, default 50). If focus never escapes the container, the rule fails with `traversalResult.isTrapped === true`.

This is a Level A violation — the most severe WCAG conformance level. A keyboard trap prevents users from navigating to the rest of the page, effectively making all content beyond the trap inaccessible.

### Common Causes

**Modal dialogs without an Escape key handler:**

```javascript
// Modal opens, but there's no way to close it via keyboard
function openModal() {
  document.getElementById('modal').style.display = 'block';
  document.getElementById('modal-first-input').focus();
}
// Missing: keydown listener for Escape
```

**Custom widgets with cyclic tabIndex manipulation:**

```javascript
// This creates a focus loop — Tab always stays within the widget
container.querySelectorAll('[tabindex]').forEach((el, i, all) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      all[(i + 1) % all.length].focus(); // Cycles forever
    }
  });
});
```

**Focus management code that calls `.focus()` on blur:**

```javascript
// This traps focus — any attempt to leave pulls you back
input.addEventListener('blur', () => {
  input.focus(); // Trap!
});
```

**`<iframe>` content that captures focus** without providing a way for keyboard users to exit.

### How to Fix

**Add an Escape key handler to modal dialogs:**

```javascript
function openModal() {
  const modal = document.getElementById('modal');
  const trigger = document.activeElement; // Remember what opened it

  modal.style.display = 'block';
  modal.querySelector('[tabindex="-1"], button, input').focus();

  modal.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      modal.style.display = 'none';
      trigger.focus(); // Return focus to the trigger element
      modal.removeEventListener('keydown', handler);
    }
  });
}
```

**For intentional focus traps (modal dialogs):** It is acceptable for a modal dialog to trap Tab key within the dialog — in fact, this is the expected behavior per the [WAI-ARIA Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). The key requirement is that Escape must close the dialog and return focus to the trigger.

When testing with `traverseSubTree()`, a modal that traps Tab will report `isTrapped: true`. This is expected. Test the Escape exit separately:

```typescript
// Verify the modal traps Tab (expected behavior for modals)
const result = await a11y.traverseSubTree('#modal', 20);
expect(result.isTrapped).toBe(true);

// Verify Escape exits the modal (required for WCAG 2.1.2)
const afterEscape = await a11y.pressKey('Escape');
expect(afterEscape.focusedElement?.id).toBe('modal-trigger');
```

**Ensure focus management doesn't create cycles:**

```javascript
// Instead of preventing Tab from leaving, manage focus with roving tabindex
function initRovingTabindex(container) {
  const items = container.querySelectorAll('[role="tab"]');
  items.forEach((item, i) => {
    item.setAttribute('tabindex', i === 0 ? '0' : '-1');
    item.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        items[i].setAttribute('tabindex', '-1');
        const next = items[(i + 1) % items.length];
        next.setAttribute('tabindex', '0');
        next.focus();
      }
      // Tab naturally escapes — no preventDefault needed
    });
  });
}
```

**Further reading:** [Understanding WCAG 2.1.2 — No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html)

---

## Using the Audit Tools

### Cypress

The Cypress plugin provides one-liner commands that check these rules and report issues:

```typescript
cy.a11yCheckFocusAndReport();                    // checks focus-not-visible + focus-low-contrast
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
import { formatFocusIssues, formatTrapIssue } from '@a11y-oracle/audit-formatter';

const focusIssues = formatFocusIssues(state, { project: 'my-app', specName: 'test.ts' });
const trapIssues = formatTrapIssue(result, '#container', { project: 'my-app', specName: 'test.ts' });
```

See the [@a11y-oracle/audit-formatter README](../libs/audit-formatter/README.md) for the full API.
