/** "Nice" upper bound for an axis (1, 2, 2.5, 5 × 10^n) so gridline labels are round. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 2, 2.5, 5, 10]) if (value <= m * exp) return m * exp;
  return 10 * exp;
}

const whole = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 });

/** Short axis label in euros from cents: `0 €`, `250 €`, `1.500 €`. */
export const axisMoney = (cents: number): string => `${whole.format(Math.round(cents / 100))} €`;
