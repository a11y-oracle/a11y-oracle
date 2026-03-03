/**
 * @module selector
 *
 * Utilities for generating CSS selectors and HTML snippets from
 * A11y-Oracle element data structures.
 *
 * Selector priority: `#id` > `tag.class1.class2` > `tag[role="..."]` > `tag`
 */

import type { A11yFocusedElement } from '@a11y-oracle/core-engine';
import type { TabOrderEntry } from '@a11y-oracle/focus-analyzer';

/** Escape HTML special characters in attribute values and text content. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape characters that break CSS attribute selectors. */
function escapeCssAttr(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Build a CSS selector from an A11yFocusedElement.
 * Priority: `#id` > `tag.class1.class2` > `tag`
 */
export function selectorFromFocusedElement(
  el: A11yFocusedElement
): string {
  if (el.id) {
    return `#${el.id}`;
  }
  const tag = el.tag.toLowerCase();
  if (el.className) {
    const classes = el.className
      .trim()
      .split(/\s+/)
      .map((c) => `.${c}`)
      .join('');
    return `${tag}${classes}`;
  }
  return tag;
}

/**
 * Build a CSS selector from a TabOrderEntry.
 * Priority: `#id` > `tag[role="..."]` > `tag`
 *
 * TabOrderEntry does not have `className`, so we use `role` as a fallback
 * to produce a more specific selector when no id is present.
 */
export function selectorFromTabOrderEntry(
  entry: TabOrderEntry
): string {
  if (entry.id) {
    return `#${entry.id}`;
  }
  const tag = entry.tag.toLowerCase();
  if (entry.role) {
    return `${tag}[role="${escapeCssAttr(entry.role)}"]`;
  }
  return tag;
}

/**
 * Build a minimal HTML snippet from an A11yFocusedElement.
 *
 * @example
 * ```typescript
 * htmlSnippetFromFocusedElement(el)
 * // => '<button id="submit" class="btn primary">Submit</button>'
 * ```
 */
export function htmlSnippetFromFocusedElement(
  el: A11yFocusedElement
): string {
  const tag = el.tag.toLowerCase();
  const attrs: string[] = [];
  if (el.id) attrs.push(`id="${escapeHtml(el.id)}"`);
  if (el.className) attrs.push(`class="${escapeHtml(el.className)}"`);
  if (el.role) attrs.push(`role="${escapeHtml(el.role)}"`);
  if (el.ariaLabel) attrs.push(`aria-label="${escapeHtml(el.ariaLabel)}"`);

  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  const content = el.textContent ? escapeHtml(el.textContent.slice(0, 80)) : '';
  return `<${tag}${attrStr}>${content}</${tag}>`;
}

/**
 * Build a minimal HTML snippet from a TabOrderEntry.
 */
export function htmlSnippetFromTabOrderEntry(
  entry: TabOrderEntry
): string {
  const tag = entry.tag.toLowerCase();
  const attrs: string[] = [];
  if (entry.id) attrs.push(`id="${escapeHtml(entry.id)}"`);
  if (entry.role) attrs.push(`role="${escapeHtml(entry.role)}"`);

  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  const content = entry.textContent ? escapeHtml(entry.textContent.slice(0, 80)) : '';
  return `<${tag}${attrStr}>${content}</${tag}>`;
}
