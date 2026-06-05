import type { MaskitoOptions } from '@maskito/core';
import { maskitoNumberOptionsGenerator } from '@maskito/kit';

/**
 * Shared Maskito presets for form controls.
 *
 * Maskito masks operate on the DOM (no ControlValueAccessor), so they compose
 * directly with Signal Forms: `<input [maskito]="numberMask" [formField]="f">`.
 *
 * NOTE: a masked control value is a STRING (e.g. "1,234,567"). To store a real
 * number, parse on submit with `maskitoParseNumber`, or bridge via Signal Forms'
 * `transformedValue()`.
 */

/**
 * Number / numeric-only: digits grouped with thousand separators, no decimals.
 * Replaces the old "numeric only" filter directive — non-digits cannot be typed.
 */
export const numberMask: MaskitoOptions = maskitoNumberOptionsGenerator({
  thousandSeparator: ',',
  maximumFractionDigits: 0,
  min: 0,
});
