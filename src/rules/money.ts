/**
 * Pure financial arithmetic. No React, no product/rate assumptions — those are
 * decided elsewhere (constants.ts, and products.ts / rate.ts in M3) and handed
 * in as plain numbers. This module only knows the formulas.
 */
import { APR_ANNUALISATION, GST_ON_FEES } from './constants';
import type { AprInputs, AprResult, LoanTerms } from './types';

function assertValidLoan({ principal, annualRatePercent, months }: LoanTerms): void {
  if (!(principal > 0)) throw new Error(`principal must be positive, got ${principal}`);
  if (!(annualRatePercent >= 0)) throw new Error(`annualRatePercent must be >= 0, got ${annualRatePercent}`);
  if (!(Number.isInteger(months) && months > 0)) throw new Error(`months must be a positive integer, got ${months}`);
}

/**
 * Standard amortising-loan EMI, rounded to the nearest rupee (how EMIs are
 * actually quoted). r = 0 is a real case — an interest-free product line —
 * and must not divide by zero: EMI is simply principal / months.
 */
export function emi(loan: LoanTerms): number {
  assertValidLoan(loan);
  const { principal, annualRatePercent, months } = loan;
  const r = annualRatePercent / 100 / 12;

  if (r === 0) {
    return Math.round(principal / months);
  }

  const growth = Math.pow(1 + r, months);
  const raw = (principal * r * growth) / (growth - 1);
  return Math.round(raw);
}

/**
 * total = (rounded EMI × months) − principal. Uses the same rounded EMI the
 * borrower would actually be quoted, so this and emi() never disagree with
 * each other by a rounding artefact.
 */
export function totalInterest(loan: LoanTerms): number {
  return emi(loan) * loan.months - loan.principal;
}

/**
 * RULES.md §4.4: solve the monthly IRR on the real cash flow, then annualise
 * by simple multiplication (RBI's method — NOT effective compounding; see
 * APR_ANNUALISATION's comment in constants.ts for why the two disagree by
 * ~0.8pp on a typical loan).
 *
 * Cash flow: t=0 is what the borrower actually receives (principal minus fee,
 * GST on the fee, and any bundled insurance); t=1..months is the EMI. Only
 * fees RULES.md §4.4 lists as APR-relevant belong here — no penal charges, no
 * foreclosure fees, no stamp duty; those are excluded by the regulation this
 * models and must stay excluded.
 *
 * Bisection: the cash flow crosses zero exactly once as the discount rate
 * rises from 0 to 100%/month (monotonically decreasing, since only the fixed
 * −netDisbursal term doesn't shrink with rate) — 100 halvings is far more
 * precision than the inputs justify but costs nothing.
 */
export function aprWithFees(inputs: AprInputs): AprResult {
  const { principal, annualRatePercent, months, processingFee, bundledInsurance = 0 } = inputs;
  const gstRate = inputs.gstRate ?? GST_ON_FEES;

  assertValidLoan({ principal, annualRatePercent, months });
  if (processingFee < 0) throw new Error(`processingFee must be >= 0, got ${processingFee}`);
  if (bundledInsurance < 0) throw new Error(`bundledInsurance must be >= 0, got ${bundledInsurance}`);

  const gstOnFee = processingFee * gstRate;
  const netDisbursal = principal - processingFee - gstOnFee - bundledInsurance;
  if (!(netDisbursal > 0)) {
    throw new Error(
      `netDisbursal must be positive; fees (${processingFee + gstOnFee + bundledInsurance}) meet or exceed principal (${principal})`,
    );
  }

  const monthlyEmi = emi({ principal, annualRatePercent, months });

  const npv = (rate: number): number => {
    let value = -netDisbursal;
    for (let t = 1; t <= months; t += 1) {
      value += monthlyEmi / Math.pow(1 + rate, t);
    }
    return value;
  };

  let lo = 0;
  let hi = 1; // 100%/month is an absurd upper bound for any real loan; safe bracket
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const monthlyIRR = (lo + hi) / 2;
  const aprPercent = monthlyIRR * APR_ANNUALISATION * 100;

  return { emi: monthlyEmi, netDisbursal, monthlyIRR, aprPercent };
}

/**
 * Indian digit grouping: thousands, then pairs (lakh, crore) —
 * ₹8,00,000 not ₹800,000. Rounds to the nearest whole rupee first; this app
 * never shows paise.
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();

  if (digits.length <= 3) {
    return `${sign}₹${digits}`;
  }

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `${sign}₹${grouped},${lastThree}`;
}
