# oracle/keyboard-trap

**WCAG 2.1.2 — No Keyboard Trap (Level A)** | Impact: `critical`

> Interactive content must not trap keyboard focus.

## What It Checks

A11y-Oracle focuses the first element inside a container, then presses Tab repeatedly (up to `maxTabs` times, default 50). If focus never escapes the container, the rule fails with `traversalResult.isTrapped === true`.

This is a Level A violation — the most severe WCAG conformance level. A keyboard trap prevents users from navigating to the rest of the page, effectively making all content beyond the trap inaccessible.

## Common Causes

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

## How to Fix

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

## Further Reading

- [Understanding WCAG 2.1.2 — No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html)
- [Back to Remediation Guide](../REMEDIATION.md)
