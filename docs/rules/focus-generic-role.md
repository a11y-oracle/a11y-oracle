# oracle/focus-generic-role

**WCAG 4.1.2 — Name, Role, Value (Level A)** | Impact: `serious`

> Focused element must have a meaningful role.

## What It Checks

When an interactive element receives keyboard focus, A11y-Oracle reads the element's ARIA role from the browser's accessibility tree. If the role is `generic`, `none`, or `presentation`, the rule fails.

These roles indicate that the element provides no semantic information to assistive technologies. A screen reader user will hear nothing meaningful about the element — they may not even know it's interactive.

This rule and [`oracle/focus-missing-name`](./focus-missing-name.md) are mutually exclusive: if the role is generic/presentational, only this rule fires (not the name check), since fixing the role is the higher priority.

## Common Causes

**`<div>` or `<span>` with `tabindex` but no role:**

```html
<!-- Browser assigns role="generic" — screen reader says nothing useful -->
<div tabindex="0" onclick="handleClick()">Click me</div>
```

**Custom interactive components that forgot to add a role:**

```html
<!-- A dropdown trigger without role — generic to assistive tech -->
<span tabindex="0" class="dropdown-toggle">
  Options <i class="icon-chevron"></i>
</span>
```

**`role="presentation"` or `role="none"` on focusable elements:**

```html
<!-- Contradictory: focusable but explicitly no role -->
<div role="presentation" tabindex="0">Interactive widget</div>
```

This is a direct conflict — `role="presentation"` says "ignore this element" while `tabindex="0"` says "this element is interactive." Browsers handle this inconsistently.

**CSS framework components with no semantic HTML:**

```html
<!-- Framework-generated markup without semantics -->
<div class="btn btn-primary" tabindex="0">Submit</div>
```

## How to Fix

**Use semantic HTML elements instead of `<div>` and `<span>`:**

```html
<!-- Before: generic role -->
<div tabindex="0" onclick="handleClick()">Click me</div>

<!-- After: semantic button -->
<button onclick="handleClick()">Click me</button>
```

Semantic elements (`<button>`, `<a>`, `<input>`, `<select>`) automatically have the correct roles and keyboard behavior.

**Add an explicit ARIA role when semantic HTML isn't possible:**

```html
<!-- Before: generic -->
<span tabindex="0" class="dropdown-toggle">Options</span>

<!-- After: has a role -->
<span role="button" tabindex="0" class="dropdown-toggle">Options</span>
```

**Remove `role="presentation"` or `role="none"` from focusable elements:**

```html
<!-- Before: contradictory -->
<div role="presentation" tabindex="0">Widget</div>

<!-- After: meaningful role -->
<div role="button" tabindex="0">Widget</div>
```

**Replace framework components with semantic equivalents:**

```html
<!-- Before: styled div -->
<div class="btn btn-primary" tabindex="0">Submit</div>

<!-- After: actual button with classes -->
<button class="btn btn-primary">Submit</button>
```

## Common Roles for Interactive Elements

| Element Type | Semantic HTML | ARIA Role Alternative |
|---|---|---|
| Button | `<button>` | `role="button"` |
| Link | `<a href="...">` | `role="link"` |
| Checkbox | `<input type="checkbox">` | `role="checkbox"` |
| Tab | — | `role="tab"` |
| Menu item | — | `role="menuitem"` |
| Switch | — | `role="switch"` |

## Axe-Core Overlap

Axe-core checks for elements with `role="presentation"` or `role="none"` that have focusable descendants (`presentational-role-conflicts`). However, it does not catch `<div tabindex="0">` elements with no explicit role, because the browser's implicit `generic` role is technically valid HTML. A11y-Oracle catches this during keyboard navigation because the element is reachable by keyboard yet provides no useful semantic information.

## Further Reading

- [Understanding WCAG 4.1.2 — Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
- [WAI-ARIA Roles](https://www.w3.org/TR/wai-aria-1.2/#role_definitions)
- [Back to Remediation Guide](../REMEDIATION.md)
