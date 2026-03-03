import { describe, it, expect } from 'vitest';
import {
  formatFocusIssues,
  formatTrapIssue,
  formatNameIssues,
  formatRoleIssues,
  formatTabIndexIssues,
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
    expect(node.html).toContain('id="nav-btn"');
    expect(node.target).toEqual(['#nav-btn']);
    expect(node.any).toEqual([]);
    expect(node.all).toEqual([]);
    expect(node.none).toHaveLength(1);
    expect(node.failureSummary).toContain('Fix any of the following');
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

// ---- Helpers for speech-result-based formatters ----

function makeSpeechResult(overrides: Record<string, unknown> = {}) {
  return {
    speech: 'Submit, button',
    name: 'Submit',
    role: 'button',
    states: [],
    rawNode: {
      nodeId: '1',
      ignored: false,
      role: { type: 'role', value: 'button' },
      name: { type: 'computedString', value: 'Submit' },
      properties: [],
      childIds: [],
    },
    ...overrides,
  };
}

describe('formatNameIssues', () => {
  it('returns empty array when no element is focused', () => {
    const state = makeState({ focusedElement: null });
    expect(formatNameIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when no speechResult', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: null,
    });
    expect(formatNameIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when element has a name', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({ name: 'Submit' }),
    });
    expect(formatNameIssues(state, CTX)).toEqual([]);
  });

  it('returns oracle/focus-missing-name when name is empty', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        name: '',
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'button' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const issues = formatNameIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-missing-name');
    expect(issues[0].impact).toBe('serious');
    expect(issues[0].resultType).toBe('oracle');
    expect(issues[0].tags).toContain('wcag412');
  });

  it('returns oracle/focus-missing-name when name is whitespace only', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({ name: '   ' }),
    });
    const issues = formatNameIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-missing-name');
  });

  it('skips elements with generic roles (handled by formatRoleIssues)', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        name: '',
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'generic' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    expect(formatNameIssues(state, CTX)).toEqual([]);
  });

  it('skips elements with presentation role', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        name: '',
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'presentation' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    expect(formatNameIssues(state, CTX)).toEqual([]);
  });

  it('includes selector and html in issue', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({ name: '' }),
    });
    const issues = formatNameIssues(state, CTX);
    expect(issues[0].selector).toBe('#nav-btn');
    expect(issues[0].htmlSnippet).toContain('nav-btn');
  });
});

describe('formatRoleIssues', () => {
  it('returns empty array when no element is focused', () => {
    const state = makeState({ focusedElement: null });
    expect(formatRoleIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when no speechResult', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: null,
    });
    expect(formatRoleIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when element has a meaningful role', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult(),
    });
    expect(formatRoleIssues(state, CTX)).toEqual([]);
  });

  it('returns oracle/focus-generic-role when role is "generic"', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'generic' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const issues = formatRoleIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-generic-role');
    expect(issues[0].impact).toBe('serious');
    expect(issues[0].resultType).toBe('oracle');
    expect(issues[0].tags).toContain('wcag412');
  });

  it('fires for "none" role', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'none' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const issues = formatRoleIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-generic-role');
  });

  it('fires for "presentation" role', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'presentation' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const issues = formatRoleIssues(state, CTX);
    expect(issues).toHaveLength(1);
  });

  it('does NOT fire for empty-string role (missing data)', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: '' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    expect(formatRoleIssues(state, CTX)).toEqual([]);
  });

  it('includes role data in the check', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'generic' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const issues = formatRoleIssues(state, CTX);
    expect(issues[0].nodes[0].none[0].data).toEqual({ role: 'generic' });
  });
});

describe('formatTabIndexIssues', () => {
  it('returns empty array when no element is focused', () => {
    const state = makeState({ focusedElement: null });
    expect(formatTabIndexIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when tabIndex is 0', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 0 },
    });
    expect(formatTabIndexIssues(state, CTX)).toEqual([]);
  });

  it('returns empty array when tabIndex is -1', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: -1 },
    });
    expect(formatTabIndexIssues(state, CTX)).toEqual([]);
  });

  it('returns oracle/positive-tabindex when tabIndex > 0', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 5 },
    });
    const issues = formatTabIndexIssues(state, CTX);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/positive-tabindex');
    expect(issues[0].impact).toBe('serious');
    expect(issues[0].resultType).toBe('oracle');
    expect(issues[0].tags).toContain('wcag243');
  });

  it('includes tabIndex data in the check', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 10 },
    });
    const issues = formatTabIndexIssues(state, CTX);
    expect(issues[0].nodes[0].none[0].data).toEqual({ tabIndex: 10 });
  });

  it('fires for tabIndex of 1', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 1 },
    });
    const issues = formatTabIndexIssues(state, CTX);
    expect(issues).toHaveLength(1);
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
      speechResult: makeSpeechResult(),
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    expect(formatAllIssues(state, CTX)).toEqual([]);
  });

  it('catches missing name issues', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({ name: '' }),
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    const issues = formatAllIssues(state, CTX);
    expect(issues.some((i) => i.ruleId === 'oracle/focus-missing-name')).toBe(
      true
    );
  });

  it('catches generic role issues', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'generic' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    const issues = formatAllIssues(state, CTX);
    expect(
      issues.some((i) => i.ruleId === 'oracle/focus-generic-role')
    ).toBe(true);
  });

  it('catches positive tabindex issues', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 5 },
      speechResult: makeSpeechResult(),
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    const issues = formatAllIssues(state, CTX);
    expect(
      issues.some((i) => i.ruleId === 'oracle/positive-tabindex')
    ).toBe(true);
  });

  it('can return multiple issues from different rules', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 3 },
      speechResult: makeSpeechResult({ name: '' }),
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatAllIssues(state, CTX);
    // Should catch: focus-not-visible + missing-name + positive-tabindex
    expect(issues.length).toBeGreaterThanOrEqual(3);
    const ruleIds = issues.map((i) => i.ruleId);
    expect(ruleIds).toContain('oracle/focus-not-visible');
    expect(ruleIds).toContain('oracle/focus-missing-name');
    expect(ruleIds).toContain('oracle/positive-tabindex');
  });

  it('wcag22a filters out AA rules', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatAllIssues(state, {
      ...CTX,
      wcagLevel: 'wcag22a',
    });
    expect(issues).toHaveLength(0);
  });

  it('wcag22aa includes all rules (default behavior)', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatAllIssues(state, {
      ...CTX,
      wcagLevel: 'wcag22aa',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/focus-not-visible');
  });

  it('undefined wcagLevel defaults to wcag22aa (includes all)', () => {
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

  it('wcag22a keeps Level A rules', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 5 },
      speechResult: makeSpeechResult(),
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    const issues = formatAllIssues(state, {
      ...CTX,
      wcagLevel: 'wcag22a',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('oracle/positive-tabindex');
  });

  it('wcag21aa includes focus-not-visible but excludes focus-low-contrast', () => {
    // focus-not-visible is WCAG 2.0 AA, focus-low-contrast is WCAG 2.2 AA
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: true,
        contrastRatio: 2.1,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatAllIssues(state, {
      ...CTX,
      wcagLevel: 'wcag21aa',
    });
    // focus-low-contrast should be filtered (WCAG 2.2)
    expect(issues).toHaveLength(0);

    // Now with isVisible: false (triggers focus-not-visible, WCAG 2.0 AA)
    const state2 = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues2 = formatAllIssues(state2, {
      ...CTX,
      wcagLevel: 'wcag21aa',
    });
    expect(issues2).toHaveLength(1);
    expect(issues2[0].ruleId).toBe('oracle/focus-not-visible');
  });

  it('disabledRules suppresses specified rules', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 5 },
      speechResult: makeSpeechResult({ name: '' }),
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    });
    const issues = formatAllIssues(state, {
      ...CTX,
      disabledRules: ['oracle/positive-tabindex'],
    });
    const ruleIds = issues.map((i) => i.ruleId);
    expect(ruleIds).not.toContain('oracle/positive-tabindex');
    expect(ruleIds).toContain('oracle/focus-missing-name');
  });

  it('disabledRules + wcagLevel work together', () => {
    const state = makeState({
      focusedElement: { ...FOCUSED_BUTTON, tabIndex: 5 },
      speechResult: makeSpeechResult({ name: '' }),
      focusIndicator: {
        isVisible: false,
        contrastRatio: null,
        meetsWCAG_AA: false,
      },
    });
    const issues = formatAllIssues(state, {
      ...CTX,
      wcagLevel: 'wcag22a',
      disabledRules: ['oracle/positive-tabindex'],
    });
    const ruleIds = issues.map((i) => i.ruleId);
    // AA rule (focus-not-visible) filtered by level, positive-tabindex disabled
    expect(ruleIds).not.toContain('oracle/focus-not-visible');
    expect(ruleIds).not.toContain('oracle/positive-tabindex');
    expect(ruleIds).toContain('oracle/focus-missing-name');
  });
});

describe('boundary tests', () => {
  it('contrast ratio exactly 3.0 should pass (meetsWCAG_AA true)', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      focusIndicator: {
        isVisible: true,
        contrastRatio: 3.0,
        meetsWCAG_AA: true,
      },
    });
    expect(formatFocusIssues(state, CTX)).toEqual([]);
  });

  it('speechResult with rawNode undefined does not throw in formatNameIssues', () => {
    const state = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({ rawNode: undefined }),
    });
    expect(() => formatNameIssues(state, CTX)).not.toThrow();
  });

  it('formatNameIssues and formatRoleIssues never both fire for same state', () => {
    const genericState = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        name: '',
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'generic' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const nameIssues = formatNameIssues(genericState, CTX);
    const roleIssues = formatRoleIssues(genericState, CTX);
    // With a generic role, only role issues fire, not name issues
    expect(nameIssues).toHaveLength(0);
    expect(roleIssues).toHaveLength(1);

    const buttonState = makeState({
      focusedElement: FOCUSED_BUTTON,
      speechResult: makeSpeechResult({
        name: '',
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'button' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      }),
    });
    const nameIssues2 = formatNameIssues(buttonState, CTX);
    const roleIssues2 = formatRoleIssues(buttonState, CTX);
    // With a meaningful role, only name issues fire, not role issues
    expect(nameIssues2).toHaveLength(1);
    expect(roleIssues2).toHaveLength(0);
  });
});
