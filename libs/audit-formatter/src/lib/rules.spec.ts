import { describe, it, expect } from 'vitest';
import { RULES, RULE_IDS, getRule } from './rules.js';

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
