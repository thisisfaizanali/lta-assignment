/**
 * Display-only formatting. No financial calculation lives here — formatINR
 * itself is money.ts's (M2); this just wraps it plus adds a percent/band
 * formatter for consistent rendering across screens.
 */
import { formatINR } from '../rules/money';
import type { Band } from '../rules/types';

export { formatINR };

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatMoneyBand(band: Band): string {
  return `${formatINR(band.lo)} – ${formatINR(band.hi)}`;
}

export function formatPercentBand(band: Band): string {
  return `${formatPercent(band.lo)} – ${formatPercent(band.hi)}`;
}

/** Compact lakh figure for the band visual's axis labels, e.g. ₹8.0L. */
export function formatLakhCompact(rupees: number): string {
  return `₹${(rupees / 100_000).toFixed(1)}L`;
}
