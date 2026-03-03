# oracle/positive-tabindex

**WCAG 2.4.3 — Focus Order (Level A)** | Impact: `serious`

> Elements should not use positive tabindex values.

## What It Checks

When an interactive element receives keyboard focus, A11y-Oracle checks its `tabIndex` property. If `tabIndex > 0`, the rule fails.

Positive tabindex values (`tabindex="1"`, `tabindex="5"`, `tabindex="99"`, etc.) override the natural DOM focus order and create an unpredictable navigation sequence. Elements with positive tabindex receive focus before all elements with `tabindex="0"` or no tabindex, regardless of their position in the page.

This makes keyboard navigation confusing — the focus order no longer matches the visual reading order, violating user expectations.

## Common Causes

**Attempting to control focus order with positive values:**

```html
<!-- Developer tries to force a specific tab order -->
<input tabindex="3" placeholder="Last name" />
<input tabindex="1" placeholder="First name" />
<input tabindex="2" placeholder="Middle name" />
<button tabindex="4">Submit</button>
```

This creates a brittle, hard-to-maintain focus order that breaks whenever new elements are added.

**Legacy code from older accessibility practices:**

Positive tabindex was sometimes recommended in older guides. Modern best practice is to use `tabindex="0"` and rely on DOM order.

**Third-party widgets or libraries that set positive tabindex:**

Some older libraries set `tabindex="1"` or similar values on their elements, pulling focus out of the expected order.

**Misunderstanding `tabindex` values:**

```html
<!-- Developer thinks higher values mean "more important" -->
<button tabindex="100">Primary Action</button>
<!-- Actually, this just means this button gets focus before everything else -->
```

## How to Fix

**Remove positive tabindex and rely on DOM order:**

```html
<!-- Before: explicit ordering with positive tabindex -->
<input tabindex="3" placeholder="Last name" />
<input tabindex="1" placeholder="First name" />
<input tabindex="2" placeholder="Middle name" />

<!-- After: natural DOM order (rearrange HTML to match desired order) -->
<input placeholder="First name" />
<input placeholder="Middle name" />
<input placeholder="Last name" />
```

**Use `tabindex="0"` to add elements to the natural tab order:**

```html
<!-- tabindex="0" follows DOM order — predictable and maintainable -->
<div role="button" tabindex="0">Custom Button</div>
```

**Use `tabindex="-1"` for programmatic focus only:**

```html
<!-- tabindex="-1" is NOT in the tab order but can receive focus via JavaScript -->
<div id="error-message" tabindex="-1">Please fix the errors below</div>

<script>
  document.getElementById('error-message').focus();
</script>
```

**Fix the DOM order instead of using tabindex to compensate:**

If elements appear in the wrong visual order, use CSS (flexbox `order`, grid placement, or positioning) to rearrange visually while keeping the DOM order logical:

```html
<div class="flex-container">
  <nav>Navigation</nav>     <!-- Tab order: 1st -->
  <main>Content</main>       <!-- Tab order: 2nd -->
  <aside>Sidebar</aside>     <!-- Tab order: 3rd -->
</div>
```

```css
.flex-container {
  display: flex;
}
/* Visual order can differ from DOM order using CSS */
aside { order: -1; } /* Visually first, but Tab order follows DOM */
```

## Valid tabindex Values

| Value | Behavior |
|---|---|
| `tabindex="0"` | In natural tab order (follows DOM position) |
| `tabindex="-1"` | Not in tab order, focusable via JavaScript |
| `tabindex="1"` or higher | **Avoid** — overrides natural order |

## Axe-Core Overlap

Axe-core has a `tabindex` rule that flags positive tabindex values on static DOM analysis. A11y-Oracle's `oracle/positive-tabindex` catches this during keyboard navigation, which means it also detects positive tabindex on dynamically inserted elements, elements revealed by JavaScript interactions, or elements within Shadow DOM that axe-core may not reach during a static scan.

## Further Reading

- [Understanding WCAG 2.4.3 — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- [MDN: tabindex attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex)
- [Back to Remediation Guide](../REMEDIATION.md)
