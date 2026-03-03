import { describe, it, expect } from 'vitest';
import { RULES, RULE_IDS, getRule, matchesWcagLevel } from './rules.js';

describe('RULES', () => {
  it('defines exactly six rules', () => {
    expect(RULE_IDS).toHaveLength(6);
  });

  it('all ruleIds start with oracle/', () => {
    for (const id of RULE_IDS) {
      expect(id).toMatch(/^oracle\//);
    }
  });

  it.each(RULE_IDS)('%s has all required metadata fields', (ruleId) => {
    const rule = RULES[ruleId];
    expect(rule.ruleId).toBe(ruleId);
    expect(rule.help).toBeTruthy();
    expect(rule.description).toBeTruthy();
    expect(rule.impact).toMatch(/^(minor|moderate|serious|critical)$/);
    expect(rule.tags.length).toBeGreaterThan(0);
    expect(rule.helpUrl).toMatch(/^https:\/\/www\.w3\.org/);
    expect(rule.failureSummary).toBeTruthy();
  });

  it('all rules have the "oracle" tag', () => {
    for (const id of RULE_IDS) {
      expect(RULES[id].tags).toContain('oracle');
    }
  });

  it('all rules have the "cat.keyboard" tag', () => {
    for (const id of RULE_IDS) {
      expect(RULES[id].tags).toContain('cat.keyboard');
    }
  });

  it('focus-not-visible has impact "serious"', () => {
    expect(RULES['oracle/focus-not-visible'].impact).toBe('serious');
  });

  it('focus-low-contrast has impact "moderate"', () => {
    expect(RULES['oracle/focus-low-contrast'].impact).toBe('moderate');
  });

  it('keyboard-trap has impact "critical"', () => {
    expect(RULES['oracle/keyboard-trap'].impact).toBe('critical');
  });

  it('focus-missing-name has impact "serious"', () => {
    expect(RULES['oracle/focus-missing-name'].impact).toBe('serious');
  });

  it('focus-generic-role has impact "serious"', () => {
    expect(RULES['oracle/focus-generic-role'].impact).toBe('serious');
  });

  it('positive-tabindex has impact "serious"', () => {
    expect(RULES['oracle/positive-tabindex'].impact).toBe('serious');
  });
});

describe('getRule', () => {
  it('returns a rule by ID', () => {
    const rule = getRule('oracle/focus-not-visible');
    expect(rule.ruleId).toBe('oracle/focus-not-visible');
    expect(rule.impact).toBe('serious');
  });

  it('throws for unknown rule ID', () => {
    expect(() => getRule('oracle/nonexistent')).toThrow(
      'Unknown oracle rule: oracle/nonexistent'
    );
  });
});

describe('matchesWcagLevel', () => {
  it('wcag22aa (default) includes all rules', () => {
    for (const id of RULE_IDS) {
      expect(matchesWcagLevel(RULES[id], 'wcag22aa')).toBe(true);
    }
  });

  it('wcag22a includes only Level A rules', () => {
    expect(matchesWcagLevel(RULES['oracle/keyboard-trap'], 'wcag22a')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-missing-name'], 'wcag22a')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-generic-role'], 'wcag22a')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/positive-tabindex'], 'wcag22a')).toBe(true);
  });

  it('wcag22a excludes AA-only rules', () => {
    expect(matchesWcagLevel(RULES['oracle/focus-not-visible'], 'wcag22a')).toBe(false);
    expect(matchesWcagLevel(RULES['oracle/focus-low-contrast'], 'wcag22a')).toBe(false);
  });

  it('wcag21aa includes focus-not-visible (WCAG 2.0 AA) but excludes focus-low-contrast (WCAG 2.2 AA)', () => {
    expect(matchesWcagLevel(RULES['oracle/focus-not-visible'], 'wcag21aa')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-low-contrast'], 'wcag21aa')).toBe(false);
  });

  it('wcag21aa includes all Level A rules', () => {
    expect(matchesWcagLevel(RULES['oracle/keyboard-trap'], 'wcag21aa')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-missing-name'], 'wcag21aa')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-generic-role'], 'wcag21aa')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/positive-tabindex'], 'wcag21aa')).toBe(true);
  });

  it('wcag2aa includes WCAG 2.0 rules but not WCAG 2.2 rules', () => {
    expect(matchesWcagLevel(RULES['oracle/focus-not-visible'], 'wcag2aa')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-low-contrast'], 'wcag2aa')).toBe(false);
    expect(matchesWcagLevel(RULES['oracle/keyboard-trap'], 'wcag2aa')).toBe(true);
  });

  it('wcag2a includes only WCAG 2.0 Level A rules', () => {
    expect(matchesWcagLevel(RULES['oracle/keyboard-trap'], 'wcag2a')).toBe(true);
    expect(matchesWcagLevel(RULES['oracle/focus-not-visible'], 'wcag2a')).toBe(false);
    expect(matchesWcagLevel(RULES['oracle/focus-low-contrast'], 'wcag2a')).toBe(false);
  });
});
