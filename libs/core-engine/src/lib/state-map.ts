/**
 * @module state-map
 *
 * Maps Chrome DevTools Protocol AXNode property values to human-readable
 * state strings used in speech output.
 *
 * CDP provides node properties as an array of `{ name, value }` objects.
 * This module translates those boolean/enumerated properties into the
 * words a screen reader would announce (e.g., `expanded: false` → `"collapsed"`).
 */

/**
 * Defines how a single CDP AXNode property maps to spoken state strings.
 *
 * For boolean properties, `trueValue` is spoken when the property is `true`,
 * and `falseValue` when `false`. An empty string means the state is not
 * announced for that value.
 */
export interface StateMapping {
  /** The CDP property name (e.g., `"expanded"`, `"checked"`). */
  property: string;
  /** The string to speak when the property value is `true`. */
  trueValue: string;
  /** The string to speak when the property value is `false`. Empty string means silent. */
  falseValue: string;
}

/**
 * Ordered list of CDP property → spoken state mappings.
 *
 * The order determines the sequence in which states appear in the speech
 * output when multiple states are present. For example, a required invalid
 * field produces `"..., required, invalid"`.
 *
 * @example
 * ```
 * aria-expanded="false" → "collapsed"
 * aria-expanded="true"  → "expanded"
 * aria-checked="true"   → "checked"
 * aria-disabled="true"  → "dimmed"
 * ```
 */
export const STATE_MAPPINGS: StateMapping[] = [
  { property: 'expanded', trueValue: 'expanded', falseValue: 'collapsed' },
  { property: 'checked', trueValue: 'checked', falseValue: 'not checked' },
  { property: 'selected', trueValue: 'selected', falseValue: '' },
  { property: 'pressed', trueValue: 'pressed', falseValue: 'not pressed' },
  { property: 'disabled', trueValue: 'dimmed', falseValue: '' },
  { property: 'required', trueValue: 'required', falseValue: '' },
  { property: 'invalid', trueValue: 'invalid', falseValue: '' },
  { property: 'readonly', trueValue: 'read only', falseValue: '' },
  { property: 'multiselectable', trueValue: 'multi selectable', falseValue: '' },
];

/**
 * Represents a single property from a CDP AXNode's `properties` array.
 *
 * CDP encodes property values as `{ type, value }` objects. For boolean
 * properties, `type` is `"boolean"` or `"booleanOrUndefined"` and `value`
 * is `true` or `false`.
 */
export interface AXNodeProperty {
  name: string;
  value: { type: string; value?: unknown };
}

/**
 * Extract human-readable state strings from a CDP AXNode's properties array.
 *
 * Iterates through {@link STATE_MAPPINGS} and checks whether each mapped
 * property is present in the node's properties. Also handles the special
 * `level` property for headings.
 *
 * @param properties - The `properties` array from a CDP AXNode, or `undefined`.
 * @returns An array of state strings (e.g., `["collapsed"]`, `["checked", "required"]`).
 *          Returns an empty array if no properties are present or none match.
 *
 * @example
 * ```typescript
 * extractStates([
 *   { name: 'expanded', value: { type: 'boolean', value: false } },
 *   { name: 'required', value: { type: 'boolean', value: true } },
 * ]);
 * // → ['collapsed', 'required']
 *
 * extractStates([
 *   { name: 'level', value: { type: 'integer', value: 2 } },
 * ]);
 * // → ['level 2']
 * ```
 */
export function extractStates(
  properties: AXNodeProperty[] | undefined
): string[] {
  if (!properties || properties.length === 0) return [];

  const states: string[] = [];

  for (const mapping of STATE_MAPPINGS) {
    const prop = properties.find((p) => p.name === mapping.property);
    if (!prop) continue;

    const val = prop.value?.value;
    if (val === true || val === 'true') {
      if (mapping.trueValue) states.push(mapping.trueValue);
    } else if (val === false || val === 'false') {
      if (mapping.falseValue) states.push(mapping.falseValue);
    }
  }

  // Handle heading level (special property, not boolean)
  const level = properties.find((p) => p.name === 'level');
  if (level?.value?.value !== undefined) {
    states.push(`level ${level.value.value}`);
  }

  return states;
}
