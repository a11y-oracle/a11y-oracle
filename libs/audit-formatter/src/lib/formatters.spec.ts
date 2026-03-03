import { describe, it, expect } from 'vitest';
import {
  formatFocusIssues,
  formatTrapIssue,
  formatAllIssues,
} from './formatters.js';
import type { A11yState } from '@a11y-oracle/core-engine';
import type { TraversalResult } from '@a11y-oracle/focus-analyzer';
import type { AuditContext } from './types.js';

const CTX: AuditContext = {
  project: 'test-app',
  specName: 'nav.spec.ts',
};

const FOCUSED_BUTTON = {
  tag: 'BUTTON',
  id: 'nav-btn',
  className: 'btn',
  textContent: 'Products',
  role: 'button',
  ariaLabel: '',
  tabIndex: 0,
  rect: { x: 0, y: 0, width: 100, height: 40 },
};

function makeState(overrides: Partial<A11yState>): A11yState {
  return {
    speech: '',
    speechResult: null,
    focusedElement: null,
    focusIndicator: {
      isVisible: true,
      contrastRatio: 21,
      meetsWCAG_AA: true,
    },
    ...overrides,
  };
}

describe('formatFocusIssues', () => {
  it('returns empty array when no element is focused', () => {
    const state = makeState({ focusedElement: null });
    expect(formatFocusIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when focus is visible and meets AA', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    expect(formatFocusIssues(state, CTX)).toEqual([]);
  });

  it('returns oracle/focus-not-visible when indicator is not visible', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatFocusIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-not-visible');
    expect(issues[0].impact).toBe('serious');
    expect(issues[0].resultType).toBe('oracle');
    expect(issues[0].selector).toBe('#nav-btn');
    expect(issues[0].specName).toBe('nav.spec.ts');
    expect(issues[0].project).toBe('test-app');
    expect(issues[0].tags).toContain('wcag247');
    expect(issues[0].helpUrl).toContain('focus-visible');
  });

  it('returns oracle/focus-low-contrast when visible but fails AA', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: true,
        contrastRatio: 2.1,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatFocusIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-low-contrast');
    expect(issues[0].impact).toBe('moderate');
    expect(issues[0].tags).toContain('wcag2412');
    // Contrast data is included in the check
    expect(issues[0].nodes[0].none[0].data).toEqual({
      contrastRatio: 2.1,
    });
  });

  it('focus-not-visible takes priority over focus-low-contrast', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: 1.5,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatFocusIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-not-visible');
  });

  it('includes HTML snippet and selector in issue', () => {
    const state = makeState({
      focusedElement: {
        ...FOCUSED_BUTTON,
        id: 'submit',
        className: 'primary',
      },
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatFocusIssues(state, CTX);
    expect(issues[0].selector).toBe('#submit');
    expect(issues[0].htmlSnippet).toContain('id="submit"');
    expect(issues[0].htmlSnippet).toContain('class="primary"');
  });

  it('nodes array has correct structure', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatFocusIssues(state, CTX);
    const node = issues[0].nodes[0];
    expect(node.html).toBeTruthy();
    expect(node.target).toEqual(['#nav-btn']);
    expect(node.any).toEqual([]);
    expect(node.all).toEqual([]);
    expect(node.none).toHaveLength(1);
    expect(node.failureSummary).toBeTruthy();
  });

  it('uses tag.class selector when no id', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, id: '', className: 'nav-link' },
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatFocusIssues(state, CTX);
    expect(issues[0].selector).toBe('button.nav-link');
  });
});

describe('formatTrapIssue', () => {
  it('returns empty array when not trapped', () => {
    const result: TraversalResult = {
      isTrapped: false,
      tabCount: 3,
      visitedElements: [],
      escapeElement: null,
    };
    expect(formatTrapIssue(result, '#modal', CTX)).toEqual([]);
  });

  it('returns oracle/keyboard-trap when trapped', () => {
    const result: TraversalResult = {
      isTrapped: true,
      tabCount: 10,
      visitedElements: [
        {
          index: 0,
          tag: 'INPUT',
          id: 'name',
          textContent: '',
          tabIndex: 0,
          role: '',
          rect: { x: 0, y: 0, width: 200, height: 30 },
        },
      ],
      escapeElement: null,
    };
    const issues = formatTrapIssue(result, '#modal', CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/keyboard-trap');
    expect(issues[0].impact).toBe('critical');
    expect(issues[0].selector).toBe('#modal');
    expect(issues[0].resultType).toBe('oracle');
    expect(issues[0].tags).toContain('wcag212');
    expect(issues[0].nodes).toHaveLength(1);
    expect(issues[0].specName).toBe('nav.spec.ts');
    expect(issues[0].project).toBe('test-app');
  });

  it('creates a container node when no visited elements', () => {
    const result: TraversalResult = {
      isTrapped: true,
      tabCount: 10,
      visitedElements: [],
      escapeElement: null,
    };
    const issues = formatTrapIssue(result, '#bad-trap', CTX);
    expect(issues[0].nodes).toHaveLength(1);
    expect(issues[0].nodes[0].target).toEqual(['#bad-trap']);
    expect(issues[0].nodes[0].html).toContain('#bad-trap');
  });

  it('includes tab count in check message', () => {
    const result: TraversalResult = {
      isTrapped: true,
      tabCount: 50,
      visitedElements: [
        {
          index: 0,
          tag: 'BUTTON',
          id: 'btn-1',
          textContent: 'Click',
          tabIndex: 0,
          role: '',
          rect: { x: 0, y: 0, width: 80, height: 30 },
        },
      ],
      escapeElement: null,
    };
    const issues = formatTrapIssue(result, '#container', CTX);
    const message = issues[0].nodes[0].none[0].message;
    expect(message).toContain('50 tabs attempted');
    expect(message).toContain('#container');
  });
});

describe('formatAllIssues', () => {
  it('returns focus issues from state', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatAllIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-not-visible');
  });

  it('returns empty array when no issues', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    expect(formatAllIssues(state, CTX)).toEqual([]);
  });
});
