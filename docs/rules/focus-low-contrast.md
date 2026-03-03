# oracle/focus-low-contrast

**WCAG 2.4.12 — Focus Appearance (Level AA, WCAG 2.2)** | Impact: `moderate`

> Focus indicator must have sufficient contrast (>= 3:1).

## What It Checks

When a focus indicator is visible, A11y-Oracle measures the contrast ratio between the indicator color (outline or box-shadow) and the element's background color. If the ratio is below 3:1, the rule fails with `focusIndicator.meetsWCAG_AA === false`.

The measured contrast ratio is available on `state.focusIndicator.contrastRatio` for debugging.

## Common Causes

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

## How to Fix

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

## Further Reading

- [Understanding WCAG 2.4.12 — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [Back to Remediation Guide](../REMEDIATION.md)
