/**
 * @module color-parser
 *
 * Parses CSS color values into normalized RGBA tuples.
 * Handles `rgb()`, `rgba()`, `#hex` (3, 4, 6, 8 digit),
 * and `transparent`.
 */

import type { RGBColor } from './types.js';

/**
 * Parse a CSS color string into an {@link RGBColor} tuple.
 *
 * Supports:
 * - `rgb(r, g, b)` and `rgba(r, g, b, a)`
 * - `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`
 * - `transparent` (returns black with alpha 0)
 *
 * @param css - A CSS color value string.
 * @returns The parsed color, or `null` if parsing fails.
 *
 * @example
 * ```typescript
 * parseColor('rgb(255, 0, 0)');       // { r: 255, g: 0, b: 0, a: 1 }
 * parseColor('#3498db');               // { r: 52, g: 152, b: 219, a: 1 }
 * parseColor('rgba(0, 0, 0, 0.5)');   // { r: 0, g: 0, b: 0, a: 0.5 }
 * parseColor('transparent');           // { r: 0, g: 0, b: 0, a: 0 }
 * ```
 */
export function parseColor(css: string): RGBColor | null {
  if (!css || typeof css !== 'string') return null;

  const trimmed = css.trim().toLowerCase();

  // transparent
  if (trimmed === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // rgb() and rgba()
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/
  );
  if (rgbMatch) {
    return {
      r: clamp(parseInt(rgbMatch[1], 10), 0, 255),
      g: clamp(parseInt(rgbMatch[2], 10), 0, 255),
      b: clamp(parseInt(rgbMatch[3], 10), 0, 255),
      a: rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1,
    };
  }

  // Modern space-separated rgb() / rgba() syntax: rgb(255 0 0 / 0.5)
  const rgbSpaceMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*([\d.]+%?)\s*)?\)$/
  );
  if (rgbSpaceMatch) {
    let alpha = 1;
    if (rgbSpaceMatch[4] !== undefined) {
      const alphaStr = rgbSpaceMatch[4];
      alpha = alphaStr.endsWith('%')
        ? clamp(parseFloat(alphaStr) / 100, 0, 1)
        : clamp(parseFloat(alphaStr), 0, 1);
    }
    return {
      r: clamp(parseInt(rgbSpaceMatch[1], 10), 0, 255),
      g: clamp(parseInt(rgbSpaceMatch[2], 10), 0, 255),
      b: clamp(parseInt(rgbSpaceMatch[3], 10), 0, 255),
      a: alpha,
    };
  }

  // Hex colors
  const hexMatch = trimmed.match(/^#([0-9a-f]+)$/);
  if (hexMatch) {
    const hex = hexMatch[1];

    if (hex.length === 3) {
      // #RGB → #RRGGBB
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }

    if (hex.length === 4) {
      // #RGBA → #RRGGBBAA
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255,
      };
    }

    if (hex.length === 6) {
      // #RRGGBB
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1,
      };
    }

    if (hex.length === 8) {
      // #RRGGBBAA
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: parseInt(hex.substring(6, 8), 16) / 255,
      };
    }
  }

  return null;
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
