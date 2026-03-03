import { describe, it, expect, vi } from 'vitest';
import { OracleAuditor } from './oracle-auditor.js';
import type { OrchestratorLike } from './oracle-auditor.js';
import type { A11yState } from '@a11y-oracle/core-engine';
import type { TraversalResult } from '@a11y-oracle/focus-analyzer';

const GOOD_STATE: A11yState = {
  speech: 'Home, link',
  speechResult: null,
  focusedElement: {
    tag: 'A',
    id: 'home',
    className: '',
    textContent: 'Home',
    role: 'link',
    ariaLabel: '',
    tabIndex: 0,
    rect: { x: 0, y: 0, width: 60, height: 30 },
  },
  focusIndicator: {
    isVisible: true,
    contrastRatio: 5,
    meetsWCAG_AA: true,
  },
};

const BAD_FOCUS_STATE: A11yState = {
  speech: 'Products, button',
  speechResult: null,
  focusedElement: {
    tag: 'BUTTON',
    id: 'products',
    className: '',
    textContent: 'Products',
    role: 'button',
    ariaLabel: '',
    tabIndex: 0,
    rect: { x: 60, y: 0, width: 100, height: 30 },
  },
  focusIndicator: {
    isVisible: false,
    contrastRatio: null,
    meetsWCAG_AA: false,
  },
};

const NOT_TRAPPED: TraversalResult = {
  isTrapped: false,
  tabCount: 3,
  visitedElements: [],
  escapeElement: null,
};

const TRAPPED: TraversalResult = {
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

function mockOrchestrator(
  states: A11yState[],
  trapResult: TraversalResult = NOT_TRAPPED
): OrchestratorLike {
  let callIndex = 0;
  return {
    pressKey: vi.fn().mockImplementation(() => {
      return Promise.resolve(
        states[callIndex++] ?? states[states.length - 1]
      );
    }),
    getState: vi.fn().mockImplementation(() => {
      return Promise.resolve(
        states[callIndex] ?? states[states.length - 1]
      );
    }),
    traverseSubTree: vi.fn().mockResolvedValue(trapResult),
  };
}

describe('OracleAuditor', () => {
  it('starts with zero issues', () => {
    const orch = mockOrchestrator([GOOD_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    expect(auditor.issueCount).toBe(0);
    expect(auditor.getIssues()).toEqual([]);
  });

  it('accumulates no issues when focus is good', async () => {
    const orch = mockOrchestrator([GOOD_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(0);
  });

  it('accumulates issues across multiple pressKey calls', async () => {
    const orch = mockOrchestrator([GOOD_STATE, BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'nav.spec.ts',
    });

    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(0);

    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(1);
    expect(auditor.getIssues()[0].ruleId).toBe(
      'oracle/focus-not-visible'
    );
  });

  it('pressKey returns the A11yState', async () => {
    const orch = mockOrchestrator([GOOD_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    const state = await auditor.pressKey('Tab');
    expect(state.speech).toBe('Home, link');
  });

  it('getState analyzes and returns current state', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    const state = await auditor.getState();
    expect(state.speech).toBe('Products, button');
    expect(auditor.issueCount).toBe(1);
  });

  it('checkTrap reports trap issues', async () => {
    const orch = mockOrchestrator([], TRAPPED);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    const result = await auditor.checkTrap('#modal', 10);
    expect(result.isTrapped).toBe(true);
    expect(auditor.issueCount).toBe(1);
    expect(auditor.getIssues()[0].ruleId).toBe('oracle/keyboard-trap');
  });

  it('checkTrap reports no issues when not trapped', async () => {
    const orch = mockOrchestrator([], NOT_TRAPPED);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.checkTrap('#form');
    expect(auditor.issueCount).toBe(0);
  });

  it('clear() resets accumulated issues', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(1);

    auditor.clear();
    expect(auditor.issueCount).toBe(0);
    expect(auditor.getIssues()).toEqual([]);
  });

  it('getIssues returns a copy (not the internal array)', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');

    const issues1 = auditor.getIssues();
    const issues2 = auditor.getIssues();
    expect(issues1).not.toBe(issues2);
    expect(issues1).toEqual(issues2);
  });

  it('passes context into generated issues', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'my-project',
      specName: 'checkout.spec.ts',
    });
    await auditor.pressKey('Tab');
    expect(auditor.getIssues()[0].project).toBe('my-project');
    expect(auditor.getIssues()[0].specName).toBe('checkout.spec.ts');
  });

  it('detects missing name issues via formatAllIssues', async () => {
    const missingNameState: A11yState = {
      speech: ', button',
      speechResult: {
        speech: ', button',
        name: '',
        role: 'button',
        states: [],
        rawNode: {
          nodeId: '1',
          ignored: false,
          role: { type: 'role', value: 'button' },
          name: { type: 'computedString', value: '' },
          properties: [],
          childIds: [],
        },
      } as never,
      focusedElement: {
        tag: 'BUTTON',
        id: 'no-name-btn',
        className: '',
        textContent: '',
        role: 'button',
        ariaLabel: '',
        tabIndex: 0,
        rect: { x: 0, y: 0, width: 80, height: 30 },
      },
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    };
    const orch = mockOrchestrator([missingNameState]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(1);
    expect(auditor.getIssues()[0].ruleId).toBe('oracle/focus-missing-name');
  });

  it('detects positive tabindex issues via formatAllIssues', async () => {
    const positiveTabState: A11yState = {
      speech: 'Submit, button',
      speechResult: null,
      focusedElement: {
        tag: 'BUTTON',
        id: 'submit',
        className: '',
        textContent: 'Submit',
        role: 'button',
        ariaLabel: '',
        tabIndex: 5,
        rect: { x: 0, y: 0, width: 80, height: 30 },
      },
      focusIndicator: {
        isVisible: true,
        contrastRatio: 5,
        meetsWCAG_AA: true,
      },
    };
    const orch = mockOrchestrator([positiveTabState]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(1);
    expect(auditor.getIssues()[0].ruleId).toBe('oracle/positive-tabindex');
  });

  it('deduplicates same element + same rule on consecutive calls', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE, BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    await auditor.pressKey('Tab');
    // Same element with same issue on consecutive calls → 1 not 2
    expect(auditor.issueCount).toBe(1);
  });

  it('keeps issues from different elements', async () => {
    const badState2: A11yState = {
      ...BAD_FOCUS_STATE,
      focusedElement: {
        ...BAD_FOCUS_STATE.focusedElement!,
        id: 'other-btn',
      },
    };
    const orch = mockOrchestrator([BAD_FOCUS_STATE, badState2]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(2);
  });

  it('keeps non-consecutive occurrences (bad → good → bad)', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE, GOOD_STATE, BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    await auditor.pressKey('Tab');
    await auditor.pressKey('Tab');
    // bad → good → bad: both bad occurrences kept since they're non-consecutive
    expect(auditor.issueCount).toBe(2);
  });

  it('clear() resets dedup state', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE, BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
    });
    await auditor.pressKey('Tab');
    expect(auditor.issueCount).toBe(1);

    auditor.clear();
    await auditor.pressKey('Tab');
    // After clear, dedup state is reset so same issue is counted again
    expect(auditor.issueCount).toBe(1);
  });

  it('wcag22a filters AA issues through auditor', async () => {
    const orch = mockOrchestrator([BAD_FOCUS_STATE]);
    const auditor = new OracleAuditor(orch, {
      project: 'app',
      specName: 'test.ts',
      wcagLevel: 'wcag22a',
    });
    await auditor.pressKey('Tab');
    // focus-not-visible is AA, should be filtered at Level A
    expect(auditor.issueCount).toBe(0);
  });
});
