# oracle/focus-not-visible

**WCAG 2.4.7 — Focus Visible (Level AA)** | Impact: `serious`

> Focused element must have a visible focus indicator.

## What It Checks

When an interactive element receives keyboard focus, A11y-Oracle inspects the element's computed CSS properties (`outline` and `box-shadow`) to determine whether a visible focus indicator exists. If no indicator is detected, the rule fails with `focusIndicator.isVisible === false`.

A missing focus indicator makes it impossible for keyboard users to know where they are on the page. This affects all sighted keyboard users, not just screen reader users.

## Common Causes

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

/* Also detected: rgba-transparent outlines (Chrome reports this format) */
button:focus {
  outline-color: rgba(0, 0, 0, 0);
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

## How to Fix

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

## Further Reading

- [Understanding WCAG 2.4.7 — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [Back to Remediation Guide](../REMEDIATION.md)
