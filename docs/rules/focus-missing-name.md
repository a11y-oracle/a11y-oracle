# oracle/focus-missing-name

**WCAG 4.1.2 — Name, Role, Value (Level A)** | Impact: `serious`

> Focused element must have an accessible name.

## What It Checks

When an interactive element receives keyboard focus, A11y-Oracle reads the element's computed accessible name from the browser's accessibility tree via CDP. If the name is empty (no text content, `aria-label`, or `aria-labelledby`), the rule fails.

This rule only fires for elements with a meaningful ARIA role (e.g., `button`, `link`, `textbox`). Elements with generic or presentational roles trigger [`oracle/focus-generic-role`](./focus-generic-role.md) instead, since the missing name is a secondary concern when the role itself is wrong.

Without an accessible name, screen readers announce the element's role but cannot tell users what the element does. A screen reader user might hear "button" with no indication of what the button activates.

## Common Causes

**Icon buttons without labels:**

```html
<!-- Screen reader hears: "button" — no name -->
<button>
  <svg aria-hidden="true"><use href="#icon-menu" /></svg>
</button>
```

**Empty links:**

```html
<!-- Screen reader hears: "link" — no name -->
<a href="/cart">
  <img src="cart-icon.png" />  <!-- missing alt text -->
</a>
```

**Inputs without associated labels:**

```html
<!-- Screen reader hears: "edit text" — no name -->
<input type="text" placeholder="Search..." />
<!-- placeholder is NOT a reliable accessible name in all browsers -->
```

**Custom interactive elements with no text content:**

```html
<!-- Screen reader hears: "button" — no name -->
<div role="button" tabindex="0" class="close-icon"></div>
```

## How to Fix

**Add `aria-label` to icon-only buttons:**

```html
<button aria-label="Open menu">
  <svg aria-hidden="true"><use href="#icon-menu" /></svg>
</button>
```

**Add `alt` text to images inside links:**

```html
<a href="/cart">
  <img src="cart-icon.png" alt="Shopping cart" />
</a>
```

**Associate labels with inputs:**

```html
<!-- Option 1: Explicit label -->
<label for="search">Search</label>
<input id="search" type="text" />

<!-- Option 2: aria-label -->
<input type="text" aria-label="Search products" />

<!-- Option 3: aria-labelledby -->
<h2 id="search-heading">Search</h2>
<input type="text" aria-labelledby="search-heading" />
```

**Add text content or aria-label to custom elements:**

```html
<div role="button" tabindex="0" aria-label="Close dialog" class="close-icon"></div>
```

**Use visually hidden text when you need both an icon and a name:**

```html
<button>
  <svg aria-hidden="true"><use href="#icon-save" /></svg>
  <span class="sr-only">Save document</span>
</button>
```

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

## Axe-Core Overlap

Axe-core has rules like `button-name`, `link-name`, and `input-label` that check for missing accessible names. However, those rules analyze the static DOM. A11y-Oracle's `oracle/focus-missing-name` fires during keyboard navigation, catching elements that only receive focus through dynamic interaction (e.g., elements revealed by JavaScript, focus-managed widgets, or SPA route changes).

## Further Reading

- [Understanding WCAG 4.1.2 — Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
- [Accessible Name and Description Computation](https://www.w3.org/TR/accname-1.2/)
- [Back to Remediation Guide](../REMEDIATION.md)
