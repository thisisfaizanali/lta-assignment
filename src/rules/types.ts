/**
 * Minimal types for the money/rules layer. No React. No engine output shape —
 * Outputs/Explained<T> belong to M3 once verdict.ts and engine.ts exist.
 */

/** Standard amortising-loan inputs. Rate is nominal annual, in percent (e.g. 11.5). */
export interface LoanTerms {
  principal: number;
  annualRatePercent: number;
  months: number;
}

/**
 * Inputs to the APR calculation (RULES.md §4.4). All fee/insurance amounts are
 * rupee figures already resolved by the caller (e.g. 2% of sanction, or the
 * flat ₹6,500 alternative) — money.ts does not decide which fee scenario
 * applies, only computes the resulting APR for whatever it is given.
 */
export interface AprInputs extends LoanTerms {
  /** Processing fee in rupees, before GST. */
  processingFee: number;
  /** GST rate on the fee, as a decimal (0.18 = 18%). Defaults to GST_ON_FEES. */
  gstRate?: number;
  /** Bundled insurance premium in rupees, counted only if the borrower said it was bundled. Default 0. */
  bundledInsurance?: number;
}

export interface AprResult {
  /** Monthly EMI at the nominal rate, rupees. */
  emi: number;
  /** Amount the borrower actually receives at t=0: principal minus fee, GST on fee, and insurance. */
  netDisbursal: number;
  /** Solved monthly IRR, as a decimal (0.010969 = 1.0969%). */
  monthlyIRR: number;
  /** RULES.md §4.4 annualisation: monthlyIRR × 12 × 100, as a percentage. */
  aprPercent: number;
}
