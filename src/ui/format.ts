/**
 * Display-only formatting. No financial calculation lives here — formatINR
 * itself is money.ts's (M2); this just wraps it plus adds a percent/band
 * formatter for consistent rendering across screens.
 */
import { EPS_MONEY, EPS_PERCENT } from '../rules/questions';
import { formatINR } from '../rules/money';
import type { Band } from '../rules/types';

export { formatINR };

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Review finding 9: a band narrower than the same epsilon questions.ts uses to
// decide whether a difference is worth asking about isn't worth DISPLAYING as
// a range either — same "is this difference real" judgement, reused rather
// than invented twice. Below the epsilon, show the single value (still
// band.lo — lo and hi are within epsilon of each other by definition here).
export function formatMoneyBand(band: Band): string {
  if (Math.abs(band.hi - band.lo) <= EPS_MONEY) return formatINR(band.lo);
  return `${formatINR(band.lo)} – ${formatINR(band.hi)}`;
}

export function formatPercentBand(band: Band): string {
  if (Math.abs(band.hi - band.lo) <= EPS_PERCENT) return formatPercent(band.lo);
  return `${formatPercent(band.lo)} – ${formatPercent(band.hi)}`;
}

/** Same collapse test as the formatters above, exposed so a caller can append a one-line reason. */
export function isPinnedMoneyBand(band: Band): boolean {
  return Math.abs(band.hi - band.lo) <= EPS_MONEY;
}

export function isPinnedPercentBand(band: Band): boolean {
  return Math.abs(band.hi - band.lo) <= EPS_PERCENT;
}

export const PINNED_BAND_NOTE = 'Your profile already pins this at the product ceiling — there is no spread left to show.';

/** Compact lakh figure for the band visual's axis labels, e.g. ₹8.0L. */
export function formatLakhCompact(rupees: number): string {
  return `₹${(rupees / 100_000).toFixed(1)}L`;
}
