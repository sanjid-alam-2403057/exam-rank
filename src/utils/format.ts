/**
 * Formats numbers to fixed 2 decimal digits.
 * Returns '—' when value is null, undefined, or NaN.
 */
export function fmt2(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return Number(value).toFixed(2);
}

/**
 * Rounds a number to 2 decimal places as a numeric value.
 */
export function round2(value: number): number {
  return Number(value.toFixed(2));
}
