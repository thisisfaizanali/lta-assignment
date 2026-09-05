/**
 * Minimal types for the money/rules layer. No React.
 */
import type {
  IncomeType,
  ProductId,
  Purpose,
  ScoreAnswer,
  Stance,
  UnknownRule,
} from './constants';

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

// ---------------------------------------------------------------------------
// M3 — the engine's own types
// ---------------------------------------------------------------------------

/**
 * Every output value the engine produces carries its own derivation.
 * `from` names the Answers fields that fed it, so the UI can point back at
 * "change an answer" without the UI having to re-derive that mapping itself.
 */
export interface Explained<T> {
  value: T;
  why: string;
  from: string[];
}

/** A range. Always constructed as {lo <= hi} — callers take Math.min/max rather than assume direction. */
export interface Band {
  lo: number;
  hi: number;
}

export type Verdict =
  | 'dont_borrow'
  | 'fix_something_first'
  | 'different_product'
  | 'borrow_less'
  | 'borrow';

/**
 * Everything a borrower could tell the app. Every field the engine reads is
 * optional except the six true must-answers (purpose, askAmount,
 * netMonthlyIncome, incomeType, rent, and — despite RULES.md §10.1 calling it
 * a must-question — existingEmiMonthly and householdExpenses are typed
 * optional too: §7.1 itself says a must-question gate "stands down" if it was
 * skipped, so the engine has to tolerate a skipped must-question rather than
 * assume it never happens.
 *
 * Three fields exist only to make an ALREADY-documented rule computable and
 * are not in RULES.md's §10 question table: existingDebtAPR (§7.2's
 * costly-debt gate needs a rate, not just an amount), bounceInLast3Months
 * (the fresh-distress gate needs finer granularity than the 12-month rate
 * adjustment), and isElectricVehicle (EV_RATE_CONCESSION needs to know the
 * vehicle is electric, not just that the purpose is "vehicle"). None of these
 * introduce a new threshold — they're wiring for constants that already exist.
 */
export interface Answers {
  // --- must-set (RULES.md §10.1) ---
  purpose: Purpose;
  askAmount: number;
  netMonthlyIncome: number;
  incomeType: IncomeType;
  existingEmiMonthly?: number;
  rent: number;
  householdExpenses?: number; // rupees; undefined -> resolved via UNKNOWNS.householdExpenseRatio × trueIncome
  age?: number; // collected per §10.1 Q8, NOT applied anywhere — see engine.ts comment
  creditScore?: ScoreAnswer;
  dependents?: number;

  // --- optional set (RULES.md §10.2) ---
  emergencySavingsMonths?: number;
  cardUtilisation?: number; // 0..1
  yearsAtCurrentEmployer?: number; // salaried
  itrAnnualIncome?: number; // self-employed
  businessVintageYears?: number; // self-employed
  gstAndCurrentAccount?: boolean; // self-employed; the AND already required by §3's add-back rule
  cashMonthlyIncomeBad?: number; // volatile-income bad-month figure
  cashMonthlyIncomeGood?: number; // volatile-income good-month figure (informational only)
  platformHistoryMonths?: number; // gig
  bounceInLast12Months?: boolean;
  bounceInLast3Months?: boolean; // supporting field, see interface doc comment
  existingDebtAPR?: number; // supporting field, see interface doc comment
  collateralType?: 'property' | 'gold';
  collateralValue?: number;
  collateralIsLivelihoodOrOnlyHome?: boolean;
  coApplicantIncome?: number;
  expectedMonthlyUplift?: number; // borrower's stated projected extra monthly earning, if productive
  isElectricVehicle?: boolean; // supporting field, see interface doc comment
}

/**
 * Resolves a possibly-unstated input through its UNKNOWNS entry for a given
 * stance. Shared by every module that touches an UNKNOWNS-covered field
 * (rate.ts, affordability.ts) so the resolution rule — and the `stated` flag
 * §7.0 depends on — lives in exactly one place.
 */
export function resolveUnknown<T>(
  stated: T | undefined,
  rule: UnknownRule<T>,
  stance: Stance,
): { value: T; stated: boolean; why: string } {
  if (stated !== undefined) {
    return { value: stated, stated: true, why: 'You told us this.' };
  }
  return { value: stance === 'cautious' ? rule.cautious : rule.favourable, stated: false, why: rule.why };
}

/** The four outputs, each explained, plus which inputs the engine had to fill in for itself. */
export interface Outputs {
  verdict: Explained<Verdict>;
  product: Explained<ProductId>;
  lenderMax: Explained<Band>;
  safeMax: Explained<Band>;
  rateBand: Explained<Band>;
  aprBand: Explained<Band>;
  emiCeiling: Explained<Band>;
  stress: Explained<{ survives: boolean; scenario: string }>;
  /** Answers keys the engine had to fill in from UNKNOWNS because they were never stated. */
  unresolvedInputs: string[];
}
