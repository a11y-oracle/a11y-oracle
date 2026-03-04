> **Status: ✅ IMPLEMENTED** — All 9 resolvers plus the `color-contrast` resolver (10 total) are implemented in `libs/axe-bridge`. See the [axe-bridge README](libs/axe-bridge/README.md) for API documentation.

`axe-core` throws "Incomplete" (Needs Review) whenever a WCAG rule requires **state changes, interaction, or spatial awareness** that static DOM analysis cannot reliably perform.

By expanding our `libs/axe-bridge`, we can feed these highly common `axe-core` "incomplete" rules into A11y-Oracle to automatically resolve them.

---

### 1. The Rule: `link-in-text-block` (WCAG 1.4.1 Use of Color)

> ✅ **Implemented:** `resolveLinkInTextBlock()` in `libs/axe-bridge/src/lib/resolvers/link-in-text-block.ts`

When you have a link sitting inline within a paragraph of text, WCAG requires that it must be distinguishable by something _other than just color_ (like an underline). If the underline only appears on hover or focus, the link must have a 3:1 contrast ratio against the surrounding text.

**Why Axe marks it Incomplete:** Axe can check the contrast, but it cannot safely trigger the `:hover` or `:focus` state to see if a non-color visual indicator (like an underline or background change) actually appears. It asks a human to check.

**How A11y-Oracle Automates It:**

> **Implementation note:** The final implementation checks the **default/resting state only**. If a link only has differentiation on hover/focus (e.g., underline only on hover), that is treated as a **Violation**, not a Pass. This is stricter than the original spec above.

1. **Intercept:** Grab the incomplete `link-in-text-block` node.
2. **Default-State CSS Check:** Query `window.getComputedStyle()` on the link and its parent text element. Check for non-color indicators: `text-decoration-line: underline`, `border-bottom-width > 0`, or `font-weight` difference from parent.
3. **Color Contrast Fallback:** If no non-color indicator is found, parse the link and parent text colors using `parseColor()` from `@a11y-oracle/focus-analyzer` and compute `contrastRatio()`.
4. **Resolution:** If a non-color indicator exists → **✅ Pass**. If contrast ratio >= 3.0 → **✅ Pass**. Otherwise → **❌ Violation**.

---

### 2. The Rule: `target-size` (WCAG 2.2 SC 2.5.8 Target Size Minimum)

> ✅ **Implemented:** `resolveTargetSize()` in `libs/axe-bridge/src/lib/resolvers/target-size.ts`

This is the newest WCAG 2.2 AA requirement. Interactive elements must have a clickable area of at least 24 by 24 CSS pixels, OR have sufficient spacing around them so the center-to-center distance to the next element is 24px.

**Why Axe marks it Incomplete:**
Axe struggles with elements that are absolute-positioned, inline elements that wrap across lines, or complex SVG buttons where the bounding box isn't clear in the DOM. It often flags clusters of small buttons (like pagination or social icons) for manual review.

**How A11y-Oracle Automates It:**

1. **Intercept:** Grab the incomplete `target-size` nodes.
2. **Geometric Analysis:** Use Playwright's `element.boundingBox()` API to get the exact rendered X, Y, Width, and Height of the target and its closest interactive neighbors.
3. **The Math:** Calculate the pixel dimensions. If Width/Height are $\ge$ 24, Pass. If they are smaller, calculate the intersecting radii to the nearest neighbor's bounding box.
4. **Resolution:** If the spacing math clears the 24px minimum, **✅ Pass**. If they are too close, **❌ Violation**.

---

### 3. The Rule: `skip-link` (WCAG 2.4.1 Bypass Blocks)

> ✅ **Implemented:** `resolveSkipLink()` in `libs/axe-bridge/src/lib/resolvers/skip-link.ts`

Skip links are meant to be visually hidden until a keyboard user presses the `Tab` key, at which point they must become fully visible on screen so the user knows they can skip the navigation.

**Why Axe marks it Incomplete:**
Axe can see the link exists, and it can see that it targets a valid ID on the page. However, Axe cannot physically press `Tab` and visually verify that the CSS successfully brought the link on-screen.

**How A11y-Oracle Automates It:**

1. **Intercept:** Grab the incomplete `skip-link` node.
2. **Native Interaction:** Use our `keyboard-engine` (from Phase 2) to dispatch a native `Tab` keystroke to focus the skip link.
3. **Viewport Verification:** Use our `visual-engine` to verify that the element's bounding box is now $> 0$ and is completely contained within the visible viewport bounds.
4. **Resolution:** If it appears on screen, **✅ Pass**. If it remains `opacity: 0`, `left: -9999px`, or `clip: rect(0,0,0,0)` while focused, **❌ Violation**.

---

### 4. The Rule: `content-on-hover` (WCAG 1.4.13 Content on Hover or Focus)

> ✅ **Implemented:** `resolveContentOnHover()` in `libs/axe-bridge/src/lib/resolvers/content-on-hover.ts`

If a custom tooltip, dropdown, or pop-over appears when a user hovers over an element, WCAG requires three things: it must be **Dismissible** (usually via the `Esc` key without moving the mouse), **Hoverable** (the user can move their mouse over the _new_ content without it disappearing), and **Persistent** (it doesn't vanish until the user removes hover/focus).

**Why Axe marks it Incomplete:** Axe cannot simulate complex user interaction chains. It cannot "move" a virtual mouse, check if a DOM node appeared, move the mouse _onto_ that new node, and then press the `Esc` key.

**How A11y-Oracle Automates It:**

1. **Intercept:** Grab the incomplete node triggered by `content-on-hover`.
2. **Trigger & Track:** Use Playwright/CDP to hover over the trigger element. Use a MutationObserver to capture the newly rendered content's bounding box.
3. **The Hoverable Test:** Dispatch a CDP mouse movement directly into the center coordinates of the _new_ content. If it disappears (e.g., `display: none`), **❌ Violation**.
4. **The Dismissible Test:** With the content still visible, use `keyboard-engine` to dispatch an `Escape` keypress. If the content remains visible, **❌ Violation**.
5. **Resolution:** If the content survives the hover test and disappears on `Escape`, **✅ Pass**.

---

### 5. The Rule: `scrollable-region-focusable` (WCAG 2.1.1 Keyboard)

> ✅ **Implemented:** `resolveScrollableRegionFocusable()` in `libs/axe-bridge/src/lib/resolvers/scrollable-region-focusable.ts`

If a `<div>` or `<section>` has CSS `overflow: scroll` or `auto`, and the content inside it is taller/wider than the container, a keyboard-only user must be able to scroll it. Usually, this means the container itself needs `tabindex="0"` so the user can focus it and use the arrow keys.

**Why Axe marks it Incomplete:**
Axe can easily detect a scrolling `<div>` without a `tabindex`. However, it flags it as incomplete because _if_ the scrollable region contains focusable children (like a list of links), the user can just tab through the links to naturally scroll the container. Axe asks a human: _"Are there enough focusable elements inside to reach all the content?"_

**How A11y-Oracle Automates It:**

1. **Intercept:** Grab the `scrollable-region-focusable` node.
2. **Geometry Check:** Compare `element.scrollHeight` to `element.clientHeight`. If they are equal, it's not actually scrollable. **✅ Pass** (False positive).
3. **The Child-Traversal Test:** If it _is_ scrollable, check the DOM for focusable children (links, buttons). Use CDP to focus the _last_ focusable child in that container.
4. **Scroll Verification:** Re-check the `scrollTop` property of the container. If focusing the last child caused the container to scroll to the bottom (revealing the hidden content), **✅ Pass**.
5. **Resolution:** If there are no focusable children, and the container lacks `tabindex="0"`, a keyboard user is trapped and cannot see the hidden text. **❌ Violation**.

---

### 6. The Rule: `focus-indicator` (WCAG 2.4.7 Focus Visible)

> ✅ **Implemented:** `resolveFocusIndicator()` in `libs/axe-bridge/src/lib/resolvers/focus-indicator.ts`

Every interactive element must have a visible indicator when it receives keyboard focus.

**Why Axe marks it Incomplete:**
Axe looks for CSS `:focus` pseudo-classes. But developers often use complex techniques: `box-shadow`, `:focus-visible`, global CSS resets, or even JavaScript-driven class additions (`.is-focused`). Axe cannot mathematically guarantee that these CSS rules actually result in a visible change on the screen, so it flags it for human review.

**How A11y-Oracle Automates It:**

1. **Intercept:** Grab the node flagged for missing focus indicators.
2. **The Baseline Capture:** Take a localized screenshot of the element in its resting, unfocused state.
3. **The Focus Capture:** Use CDP to dispatch a native `Tab` keystroke to focus the element. Take a second screenshot.
4. **Visual Diffing:** Use the `visual-engine` to compare the two image buffers pixel-by-pixel.
5. **Resolution:** If the two images are identical (0% pixel variance), the user receives no visual feedback that they focused the element. **❌ Violation**. If the images are mathematically different (an outline or shadow appeared), **✅ Pass**.

---

### 7. The Rule: `frame-tested` (The Cross-Origin Black Hole)

> ✅ **Implemented:** `resolveFrameTested()` in `libs/axe-bridge/src/lib/resolvers/frame-tested.ts`

If your site uses third-party iframes (e.g., a HubSpot lead form, a Stripe checkout, or a YouTube embed), `axe-core` will almost always flag the iframe as `incomplete`.

**Why Axe marks it Incomplete:** Because `axe-core` is a JavaScript library injected into your main webpage, the browser’s **Same-Origin Policy (CORS)** strictly forbids it from looking inside an iframe hosted on a different domain. Axe throws its hands up and says, _"I can't see inside this frame to test it."_

**How A11y-Oracle Automates It (Using CDP):**

1. **Intercept:** The `axe-bridge` flags the `frame-tested` incomplete result.
2. **Break the Sandbox:** Unlike standard JavaScript, the Chrome DevTools Protocol (CDP) operates _above_ the browser's security sandbox. We use Playwright's native Out-of-Process Iframe (OOPIF) capabilities to attach directly to the cross-origin frame's execution context.
3. **Inject & Test:** The tool injects a secondary, localized instance of `axe-core` _inside_ the isolated iframe and runs a targeted scan.
4. **Resolution:** The engine extracts the results from the iframe and seamlessly merges them back into your main test report. It changes the status from "Incomplete" to a definitive list of Passes/Violations for that specific third-party widget.

---

### 8. The Rule: `aria-hidden-focus`

> ✅ **Implemented:** `resolveAriaHiddenFocus()` in `libs/axe-bridge/src/lib/resolvers/aria-hidden-focus.ts`

This rule checks to ensure that no focusable elements (like buttons or links) exist inside a container that has `aria-hidden="true"`. If a screen reader user tabs to it, the browser will focus it, but the screen reader will remain dead silent.

**Why Axe marks it Incomplete:**
Axe can easily see if a `<button>` is inside an `aria-hidden` `<div>`. However, modern JavaScript frameworks often use complex focus-trapping logic (e.g., in background modals). Axe flags this as incomplete because it suspects the element _might_ be programmatically protected from receiving focus, but it can't be sure without testing it.

**How A11y-Oracle Automates It (Using the Keyboard Engine):**

1. **Intercept:** Grab the specific DOM node flagged for `aria-hidden-focus`.
2. **The "Auto-Tab" Test:** Use our Phase 2 `keyboard-engine`. We dispatch a sequence of native `Tab` keystrokes to traverse the page.
3. **The Focus Assertion:** We monitor `document.activeElement`.
4. **Resolution:** If the native Tab sequence successfully lands on that hidden button, it is a critical **❌ Violation**. If the browser or your app's JavaScript naturally skips over it during traversal, it poses no threat to the user. **✅ Pass**.

---

### 9. The Rule: `identical-links-same-purpose` (WCAG 2.4.4 Link Purpose)

> ✅ **Implemented:** `resolveIdenticalLinksSamePurpose()` in `libs/axe-bridge/src/lib/resolvers/identical-links-same-purpose.ts`

If you have multiple links on a page with the exact same text (e.g., four different "Read More" or "Click Here" buttons), WCAG requires that they either resolve to the exact same destination or have additional context.

**Why Axe marks it Incomplete:**
Axe compares the accessible text and the `href` attributes. If it sees two "Read More" links, one pointing to `/about-us` and another pointing to `https://www.yoursite.com/about-us?campaign=123`, it flags them as incomplete. It needs a human to verify if those two structurally different URLs actually represent the same logical page.

**How A11y-Oracle Automates It (Using the Node URL API):**

1. **Intercept:** Grab the array of nodes flagged for identical link text.
2. **URL Normalization:** Pass the `href` strings into Node's native `URL` parser.
3. **Sanitization:** Strip out query parameters (`?campaign=...`), anchor hashes (`#section`), and resolve relative paths (`/about-us`) against the test environment's absolute Base URI.
4. **Resolution:** Compare the sanitized, absolute URLs. If they are identical (meaning both links ultimately take the user to the exact same content), **✅ Pass**. If they resolve to two genuinely different pages (e.g., `/blog/post-1` vs `/blog/post-2`), **❌ Violation** (The user needs more descriptive link text).

---

### The Power of the Bridge

By adding these 9 rules (plus the existing `color-contrast` resolver) to our `axe-bridge`, A11y-Oracle effectively eliminates the most tedious manual QA tasks. Each resolver translates subjective visual checks into deterministic, mathematical assertions.

The `resolveAllIncomplete()` orchestrator chains all 10 resolvers in sequence, allowing a single function call to resolve all incomplete findings:

```typescript
import { resolveAllIncomplete } from '@a11y-oracle/axe-bridge';

const resolved = await resolveAllIncomplete(cdpSession, axeResults, {
  wcagLevel: 'wcag22aa',
});
```

See the [axe-bridge README](libs/axe-bridge/README.md) for complete API documentation.
