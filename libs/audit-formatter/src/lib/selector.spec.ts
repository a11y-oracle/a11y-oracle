import { describe, it, expect } from 'vitest';
import {
  selectorFromFocusedElement,
  selectorFromTabOrderEntry,
  htmlSnippetFromFocusedElement,
  htmlSnippetFromTabOrderEntry,
} from './selector.js';
import type { A11yFocusedElement } from '@a11y-oracle/core-engine';
import type { TabOrderEntry } from '@a11y-oracle/focus-analyzer';

function makeElement(
  overrides: Partial<A11yFocusedElement>
): A11yFocusedElement {
  return {
    tag: 'DIV',
    id: '',
    className: '',
    textContent: '',
    role: '',
    ariaLabel: '',
    tabIndex: 0,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<TabOrderEntry>
): TabOrderEntry {
  return {
    index: 0,
    tag: 'DIV',
    id: '',
    textContent: '',
    tabIndex: 0,
    role: '',
    rect: { x: 0, y: 0, width: 0, height: 0 },
    ...overrides,
  };
}

describe('selectorFromFocusedElement', () => {
  it('prefers #id when id is present', () => {
    const el = makeElement({
      id: 'submit',
      className: 'btn primary',
      tag: 'BUTTON',
    });
    expect(selectorFromFocusedElement(el)).toBe('#submit');
  });

  it('falls back to tag.classes when no id', () => {
    const el = makeElement({
      className: 'btn primary',
      tag: 'BUTTON',
    });
    expect(selectorFromFocusedElement(el)).toBe('button.btn.primary');
  });

  it('falls back to tag alone when no id or className', () => {
    const el = makeElement({ tag: 'INPUT' });
    expect(selectorFromFocusedElement(el)).toBe('input');
  });

  it('lowercases tag name', () => {
    const el = makeElement({ tag: 'TEXTAREA' });
    expect(selectorFromFocusedElement(el)).toBe('textarea');
  });
});

describe('selectorFromTabOrderEntry', () => {
  it('prefers #id when id is present', () => {
    const entry = makeEntry({ id: 'name-input', tag: 'INPUT' });
    expect(selectorFromTabOrderEntry(entry)).toBe('#name-input');
  });

  it('falls back to tag[role] when no id', () => {
    const entry = makeEntry({ tag: 'A', role: 'menuitem' });
    expect(selectorFromTabOrderEntry(entry)).toBe('a[role="menuitem"]');
  });

  it('falls back to tag alone when no id or role', () => {
    const entry = makeEntry({ tag: 'BUTTON' });
    expect(selectorFromTabOrderEntry(entry)).toBe('button');
  });
});

describe('htmlSnippetFromFocusedElement', () => {
  it('generates snippet with id and class', () => {
    const el = makeElement({
      id: 'sub',
      className: 'btn',
      tag: 'BUTTON',
      textContent: 'Submit',
    });
    expect(htmlSnippetFromFocusedElement(el)).toBe(
      '<button id="sub" class="btn">Submit</button>'
    );
  });

  it('includes role and aria-label', () => {
    const el = makeElement({
      tag: 'A',
      role: 'menuitem',
      ariaLabel: 'Home page',
      textContent: 'Home',
    });
    expect(htmlSnippetFromFocusedElement(el)).toBe(
      '<a role="menuitem" aria-label="Home page">Home</a>'
    );
  });

  it('handles empty element', () => {
    const el = makeElement({ tag: 'INPUT' });
    expect(htmlSnippetFromFocusedElement(el)).toBe('<input></input>');
  });

  it('truncates long text content at 80 characters', () => {
    const longText = 'A'.repeat(100);
    const el = makeElement({ tag: 'P', textContent: longText });
    const snippet = htmlSnippetFromFocusedElement(el);
    expect(snippet).toBe(`<p>${'A'.repeat(80)}</p>`);
  });
});

describe('htmlSnippetFromTabOrderEntry', () => {
  it('generates snippet with id and role', () => {
    const entry = makeEntry({
      id: 'nav-btn',
      tag: 'BUTTON',
      role: 'menuitem',
      textContent: 'Products',
    });
    expect(htmlSnippetFromTabOrderEntry(entry)).toBe(
      '<button id="nav-btn" role="menuitem">Products</button>'
    );
  });

  it('handles entry with only tag', () => {
    const entry = makeEntry({ tag: 'INPUT' });
    expect(htmlSnippetFromTabOrderEntry(entry)).toBe('<input></input>');
  });
});

describe('HTML/CSS escaping', () => {
  it('escapes quotes in id attribute for HTML snippet', () => {
    const el = makeElement({ tag: 'BUTTON', id: 'btn"quotes' });
    expect(htmlSnippetFromFocusedElement(el)).toContain('id="btn&quot;quotes"');
  });

  it('escapes <script> in ariaLabel', () => {
    const el = makeElement({
      tag: 'BUTTON',
      ariaLabel: '<script>alert("xss")</script>',
    });
    expect(htmlSnippetFromFocusedElement(el)).toContain(
      'aria-label="&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"'
    );
    expect(htmlSnippetFromFocusedElement(el)).not.toContain('<script>');
  });

  it('escapes & in textContent', () => {
    const el = makeElement({ tag: 'SPAN', textContent: 'A & B' });
    expect(htmlSnippetFromFocusedElement(el)).toContain('A &amp; B');
  });

  it('escapes HTML in TabOrderEntry snippet', () => {
    const entry = makeEntry({
      tag: 'DIV',
      id: 'x"y',
      textContent: '<b>bold</b>',
    });
    const snippet = htmlSnippetFromTabOrderEntry(entry);
    expect(snippet).toContain('id="x&quot;y"');
    expect(snippet).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes quotes in role for CSS attribute selector', () => {
    const entry = makeEntry({ tag: 'DIV', role: 'menu"item' });
    expect(selectorFromTabOrderEntry(entry)).toBe('div[role="menu\\"item"]');
  });
});
