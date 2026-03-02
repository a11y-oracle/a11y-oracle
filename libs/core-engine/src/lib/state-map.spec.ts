import { describe, it, expect } from 'vitest';
import { extractStates, STATE_MAPPINGS } from './state-map.js';
import type { AXNodeProperty } from './state-map.js';

/**
 * Helper to create an AXNodeProperty for boolean values.
 */
function boolProp(name: string, value: boolean): AXNodeProperty {
  return { name, value: { type: 'booleanOrUndefined', value } };
}

/**
 * Helper to create an AXNodeProperty for integer values.
 */
function intProp(name: string, value: number): AXNodeProperty {
  return { name, value: { type: 'integer', value } };
}

describe('extractStates', () => {
  it('returns an empty array for undefined properties', () => {
    expect(extractStates(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty properties array', () => {
    expect(extractStates([])).toEqual([]);
  });

  it('maps expanded=false to "collapsed"', () => {
    const props = [boolProp('expanded', false)];
    expect(extractStates(props)).toEqual(['collapsed']);
  });

  it('maps expanded=true to "expanded"', () => {
    const props = [boolProp('expanded', true)];
    expect(extractStates(props)).toEqual(['expanded']);
  });

  it('maps checked=true to "checked"', () => {
    const props = [boolProp('checked', true)];
    expect(extractStates(props)).toEqual(['checked']);
  });

  it('maps checked=false to "not checked"', () => {
    const props = [boolProp('checked', false)];
    expect(extractStates(props)).toEqual(['not checked']);
  });

  it('maps selected=true to "selected"', () => {
    const props = [boolProp('selected', true)];
    expect(extractStates(props)).toEqual(['selected']);
  });

  it('omits selected=false (empty falseValue)', () => {
    const props = [boolProp('selected', false)];
    expect(extractStates(props)).toEqual([]);
  });

  it('maps pressed=true to "pressed"', () => {
    const props = [boolProp('pressed', true)];
    expect(extractStates(props)).toEqual(['pressed']);
  });

  it('maps pressed=false to "not pressed"', () => {
    const props = [boolProp('pressed', false)];
    expect(extractStates(props)).toEqual(['not pressed']);
  });

  it('maps disabled=true to "dimmed"', () => {
    const props = [boolProp('disabled', true)];
    expect(extractStates(props)).toEqual(['dimmed']);
  });

  it('omits disabled=false (empty falseValue)', () => {
    const props = [boolProp('disabled', false)];
    expect(extractStates(props)).toEqual([]);
  });

  it('maps required=true to "required"', () => {
    const props = [boolProp('required', true)];
    expect(extractStates(props)).toEqual(['required']);
  });

  it('maps invalid=true to "invalid"', () => {
    const props = [boolProp('invalid', true)];
    expect(extractStates(props)).toEqual(['invalid']);
  });

  it('maps readonly=true to "read only"', () => {
    const props = [boolProp('readonly', true)];
    expect(extractStates(props)).toEqual(['read only']);
  });

  it('maps multiselectable=true to "multi selectable"', () => {
    const props = [boolProp('multiselectable', true)];
    expect(extractStates(props)).toEqual(['multi selectable']);
  });

  it('extracts heading level as "level N"', () => {
    const props = [intProp('level', 2)];
    expect(extractStates(props)).toEqual(['level 2']);
  });

  it('handles level 1 correctly', () => {
    const props = [intProp('level', 1)];
    expect(extractStates(props)).toEqual(['level 1']);
  });

  it('combines multiple states in mapping order', () => {
    const props = [
      boolProp('required', true),
      boolProp('invalid', true),
      boolProp('expanded', false),
    ];
    // Order follows STATE_MAPPINGS: expanded before required before invalid
    expect(extractStates(props)).toEqual(['collapsed', 'required', 'invalid']);
  });

  it('combines states with heading level', () => {
    const props = [
      boolProp('expanded', true),
      intProp('level', 3),
    ];
    expect(extractStates(props)).toEqual(['expanded', 'level 3']);
  });

  it('ignores unknown properties', () => {
    const props = [
      { name: 'customProperty', value: { type: 'string', value: 'foo' } },
      boolProp('checked', true),
    ];
    expect(extractStates(props)).toEqual(['checked']);
  });

  it('handles string "true"/"false" values (CDP sometimes sends these)', () => {
    const props = [
      { name: 'expanded', value: { type: 'string', value: 'false' } },
    ];
    expect(extractStates(props)).toEqual(['collapsed']);
  });
});

describe('STATE_MAPPINGS', () => {
  it('contains expected mappings', () => {
    const propertyNames = STATE_MAPPINGS.map((m) => m.property);
    expect(propertyNames).toContain('expanded');
    expect(propertyNames).toContain('checked');
    expect(propertyNames).toContain('selected');
    expect(propertyNames).toContain('pressed');
    expect(propertyNames).toContain('disabled');
    expect(propertyNames).toContain('required');
    expect(propertyNames).toContain('invalid');
    expect(propertyNames).toContain('readonly');
    expect(propertyNames).toContain('multiselectable');
  });

  it('has non-empty trueValue for all mappings', () => {
    for (const mapping of STATE_MAPPINGS) {
      expect(mapping.trueValue.length).toBeGreaterThan(0);
    }
  });
});
