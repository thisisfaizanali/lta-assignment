/**
 * Every threshold, band and assumption the engine uses.
 *
 * This file is the executable half of RULES.md — section numbers below match
 * section numbers there, and no number in this codebase lives anywhere else.
 * Changing a rule is a one-line edit here.
 *
 * Rates and regulatory positions: September 2026. RBI repo rate 5.25%.
 */

// ---------------------------------------------------------------------------
// §1  Regulatory constants — the only numbers here that are actually law
// ---------------------------------------------------------------------------

/** GST on financial-service fees. Statutory. */
export const GST_ON_FEES = 0.18;

/**
 * RBI's APR is the monthly IRR annualised by simple multiplication, NOT by
 * effective compounding. Using (1+i)^12-1 overstates APR by ~0.8pp on a
 * 36-month personal loan and makes our number incomparable to the lender's KFS.
 * RBI KFS circular, 15 Apr 2024.
 */
export const APR_ANNUALISATION = 12;

/** RBI Lending Against Gold and Silver Collateral Directions, 2025 (w.e.f. 1 Apr 2026). */
export const GOLD_LTV_TIERS = [
  { upTo: 250_000, ltv: 0.85 },
  { upTo: 500_000, ltv: 0.8 },
  { upTo: Infinity, ltv: 0.75 },
] as const;

/** Mudra Tarun Plus collateral-free ceiling for micro enterprises. */
export const MUDRA_COLLATERAL_FREE_LIMIT = 2_000_000;

/**
 * RBI (Pre-payment Charges on Loans) Directions, 2025, w.e.f. 1 Jan 2026.
 * No prepayment penalty and no lock-in on FLOATING-rate loans to individuals
 * (non-business), and to individuals/MSEs for business up to this limit.
 * Note the trap: most personal loans are fixed-rate, so this does not protect
 * a typical personal-loan borrower.
 */
export const PREPAYMENT_FREE_MSE_LIMIT = 75_000_000;

// ---------------------------------------------------------------------------
// §2  Products
// ---------------------------------------------------------------------------

export type ProductId =
  | 'personal'
  | 'lap'
  | 'twowheeler_ev'
  | 'business'
  | 'gold'
  | 'home';

export interface Product {
  id: ProductId;
  label: string;
  secured: boolean;
  /** Base band before any §4 adjustment, as annual percentages. */
  rateBase: readonly [number, number];
  maxTenureMonths: number;
  /** Alternate max tenure where the product treats self-employed differently. */
  maxTenureMonthsSelfEmployed?: number;
  /** Processing fee as a fraction of sanction; see FEE_FLAT_ALTERNATIVE. */
  feePct: number;
  feeMin?: number;
  feeCap?: number;
  /** What WE are willing to advise against collateral. Lender's own is separate. */
  ltvAdvised?: number;
  /** What a lender will actually lend against the same collateral. */
  ltvLender?: number;
  amountCap: number;
  /** false = bands are approximate; RULES.md §2 flags these as coarse. */
  tuned: boolean;
  /**
   * §8's rate-rise stress only applies to floating-rate products. Not a
   * numeric threshold — a categorical fact about how each product is
   * typically priced in India (LAP/home floating, everything else fixed).
   * Added in M3 because §8 needed it and RULES.md never classified products
   * this way; no rate/amount/threshold changes.
   */
  floating: boolean;
}

export const PRODUCTS: Record<ProductId, Product> = {
  personal: {
    id: 'personal',
    label: 'Personal loan',
    secured: false,
    rateBase: [10.0, 24.0],
    maxTenureMonths: 60,
    feePct: 0.02,
    feeMin: 1_000,
    amountCap: 4_000_000,
    tuned: true,
    floating: false,
  },
  lap: {
    id: 'lap',
    label: 'Loan against property',
    secured: true,
    rateBase: [9.0, 14.0],
    maxTenureMonths: 300,
    maxTenureMonthsSelfEmployed: 180,
    feePct: 0.01,
    ltvAdvised: 0.6,
    ltvLender: 0.7,
    amountCap: 50_000_000,
    tuned: true,
    floating: true,
  },
  twowheeler_ev: {
    id: 'twowheeler_ev',
    label: 'Two-wheeler / EV loan',
    secured: true,
    rateBase: [9.5, 16.0],
    maxTenureMonths: 48,
    feePct: 0.02,
    feeMin: 1_500,
    ltvAdvised: 0.85,
    ltvLender: 0.95,
    amountCap: 300_000,
    tuned: true,
    floating: false,
  },
  business: {
    id: 'business',
    label: 'Business loan (unsecured)',
    secured: false,
    rateBase: [14.0, 26.0],
    maxTenureMonths: 48,
    feePct: 0.02,
    amountCap: 5_000_000,
    tuned: false,
    floating: false,
  },
  gold: {
    id: 'gold',
    label: 'Gold loan',
    secured: true,
    rateBase: [9.0, 24.0],
    maxTenureMonths: 36,
    feePct: 0.01,
    ltvAdvised: 0.7,
    amountCap: 10_000_000,
    tuned: false,
    floating: false,
  },
  home: {
    id: 'home',
    label: 'Home loan',
    secured: true,
    rateBase: [7.5, 11.0],
    maxTenureMonths: 300,
    feePct: 0.005,
    feeCap: 10_000,
    ltvAdvised: 0.8,
    ltvLender: 0.8,
    amountCap: Infinity,
    tuned: false,
    floating: true,
  },
};

/** EVs get a green concession at most lenders. */
export const EV_RATE_CONCESSION = -0.5;

/**
 * §2.1 Routing. Below this saving, the paperwork, valuation cost and the risk
 * of pledging a productive asset are not worth it.
 */
export const SECURED_OVERRIDE_MIN_SAVING_PP = 3.0;

// ---------------------------------------------------------------------------
// §3  Income assessment
// ---------------------------------------------------------------------------

export type IncomeType = 'salaried' | 'self_employed' | 'gig' | 'informal';

export const VOLATILE_INCOME_TYPES: readonly IncomeType[] = [
  'self_employed',
  'gig',
  'informal',
];

/** What a LENDER will credit, as a fraction of what the borrower states. */
export const ASSESSED_INCOME_FACTOR: Record<IncomeType, number> = {
  salaried: 1.0,
  self_employed: 1.0, // applied to ITR/12, not to stated cash — see below
  gig: 0.7,
  informal: 0.5,
};

/**
 * Fraction of the gap between banked cash income and ITR-declared income that a
 * good NBFC underwriter will credit — and only where GST registration AND a
 * business current account both exist. Zero without that evidence.
 */
export const SELF_EMPLOYED_CASH_ADDBACK = 0.25;

/** Months of platform payout history before gig income is assessable at all. */
export const GIG_MIN_HISTORY_MONTHS = 6;

/** A co-applicant's income counts fully for the lender, half for safety. */
export const CO_APPLICANT_LENDER_WEIGHT = 1.0;
export const CO_APPLICANT_SAFETY_WEIGHT = 0.5;

/**
 * §3 Productive-loan uplift — the most arguable rule in the model.
 * Borrowers overestimate; rates change; the loan repays from day one while the
 * earnings ramp. So: half of what they claim, capped, and delayed.
 */
export const PRODUCTIVE_UPLIFT_HAIRCUT = 0.5;
export const PRODUCTIVE_UPLIFT_CAP_OF_INCOME = 0.3;
export const PRODUCTIVE_UPLIFT_START_MONTH = 4;

// ---------------------------------------------------------------------------
// §4  Rate construction — base band plus {delta, why} adjustments
// ---------------------------------------------------------------------------

export type ScoreAnswer = number | 'dont_know' | 'never_borrowed';

/** §4.1 Credit-score tiers, as deltas on the product's base band. */
export const SCORE_TIERS = [
  { min: 780, delta: 0.0, label: '780 and above' },
  { min: 750, delta: 0.4, label: '750 to 779' },
  { min: 700, delta: 1.8, label: '700 to 749' },
  { min: 650, delta: 5.0, label: '650 to 699' },
  { min: 0, delta: 9.0, label: 'below 650' },
] as const;

/**
 * A thin file is not a bad file, and must never be priced as one. It is also
 * not a good file — there is nothing to underwrite against, which is exactly
 * why collateral changes a thin-file borrower's answer so much.
 */
export const THIN_FILE_DELTA_SECURED = 3.0;
export const THIN_FILE_UNSECURED_AVAILABLE = false;

/** §4.2 Profile adjustments. */
export const RATE_ADJUSTMENTS = {
  employerLargeTenured: 0.0,
  employerSmallOrNew: 0.75,
  selfEmployedDocumented: 1.25,
  selfEmployedThinDocs: 3.0,
  gigDocumented: 4.0,
  informalUndocumented: 8.0,

  cardUtilisationHigh: 1.5, // > 70%
  cardUtilisationMid: 0.6, // 30-70%
  cardUtilisationLow: 0.0, // < 30%

  bounceIn12Months: 2.5,
  manyRecentEnquiries: 0.5, // 3+ in 6 months

  ltvAbove70: 0.75,
  ltvBelow50: -0.5,
} as const;

export const CARD_UTILISATION_HIGH = 0.7;
export const CARD_UTILISATION_LOW = 0.3;
export const MANY_ENQUIRIES_COUNT = 3;

/**
 * §4.3 Even a fully-answered profile does not get a point estimate. Lenders
 * differ by more than a point on identical files; a single number would be a
 * lie about our own precision.
 */
export const BAND_FLOOR_WIDTH_PP = 1.2;

/**
 * §4.4 Processing fee is modelled as a RANGE, not an average. HDFC charges a
 * flat ₹6,500 on personal loans; ICICI charges up to 2%. On ₹6.5L that is
 * ₹6,500 vs ₹13,000 — a real spread that belongs in the band.
 */
export const FEE_FLAT_ALTERNATIVE = 6_500;

// ---------------------------------------------------------------------------
// §5  What a lender will sanction
// ---------------------------------------------------------------------------

export const FOIR = {
  salariedHighIncome: 0.5, // net >= FOIR_HIGH_INCOME_THRESHOLD
  salariedLowIncome: 0.4,
  selfEmployed: 0.45,
  gig: 0.35,
  informal: 0.35,
} as const;

export const FOIR_HIGH_INCOME_THRESHOLD = 50_000;

/** Collateral makes lenders more relaxed on cash-flow cover. */
export const FOIR_SECURED_BONUS = 0.05;

/** Above this, approval odds fall sharply regardless of anything else. */
export const FOIR_ABSOLUTE_CAP = 0.55;

/** Personal loans are also capped at a multiple of net monthly income. */
export const PERSONAL_LOAN_INCOME_MULTIPLE = 20;

// ---------------------------------------------------------------------------
// §6  What the borrower can safely carry
// ---------------------------------------------------------------------------

/**
 * §6.2 The single most important judgement in the model.
 *
 * The other half of surplus is what absorbs a delayed salary, a hospital week,
 * a festival month or a school fee. Committing more than half of discretionary
 * surplus to a fixed obligation is how a solvent borrower becomes a defaulting
 * one. A lender would call 50% conservative; a planner might call it loose.
 */
export const COMMIT_BASE = 0.5;

/**
 * §6.2 Commit fraction by emergency savings, in months.
 *
 * Descending `minMonths`, FIRST MATCH WINS. The bands are half-open and
 * exhaustive — every non-negative input falls in exactly one, no gaps, no
 * overlaps. Clamp negative input to 0 before lookup.
 *
 *   0 to <1  -> 0.35     boundary 0 -> 0.35
 *   1 to <3  -> 0.45     boundary 1 -> 0.45
 *   3 to <6  -> 0.50     boundary 3 -> 0.50   (this is COMMIT_BASE)
 *   >= 6     -> 0.60     boundary 6 -> 0.60
 *
 * This is the ONLY place a commit fraction is derived from savings. Unknown
 * savings resolves here too, via UNKNOWNS.emergencySavingsMonths — it does not
 * get its own fraction. RULES.md §6.2 states the same four bands; the two must
 * be read as one rule.
 */
export const COMMIT_BY_SAVINGS_MONTHS = [
  { minMonths: 6, fraction: 0.6 },
  { minMonths: 3, fraction: COMMIT_BASE },
  { minMonths: 1, fraction: 0.45 },
  { minMonths: 0, fraction: 0.35 },
] as const;

export const COMMIT_PENALTIES = {
  volatileIncome: -0.05,
  threeOrMoreDependents: -0.05,
  bounceIn12Months: -0.1,
} as const;

export const DEPENDENTS_PENALTY_THRESHOLD = 3;

export const COMMIT_FLOOR = 0.25;
export const COMMIT_CEILING = 0.6;

/**
 * §6.3 The SECOND of two affordability constraints. Not a restatement of
 * COMMIT_BASE — a different test with a different denominator:
 *
 *   commitFraction x surplus      -> denominator is SURPLUS (what's left after
 *                                    rent, household costs and existing EMIs).
 *                                    Protects month-to-month breathing room.
 *   TOTAL_EMI_CAP x trueIncome    -> denominator is TRUE INCOME (the whole
 *     - existingEMIs                 earning). Caps total debt service as a
 *                                    share of everything earned.
 *
 * emiCeiling takes the min of the two, so the binding one wins. Both subtract
 * existing EMIs, which is not double-counting: one is finding spare cash, the
 * other remaining debt-service headroom. For a borrower with cheap rent this
 * cap binds; for one with high rent the surplus test binds.
 *
 * Set below the FOIR a lender uses (§5), and applied to TRUE income rather than
 * assessed income.
 */
export const TOTAL_EMI_CAP = 0.4;

/** The commonly cited floor for household resilience. */
export const EMERGENCY_BUFFER_TARGET_MONTHS = 3;

/** EMI ceilings are rounded down so the number is memorable at a counter. */
export const EMI_CEILING_ROUNDING = 500;

/**
 * §6.3 Prudent tenure by purpose — NOT the product maximum. Consumption debt
 * should not outlive the memory of what it bought. The app always shows the
 * max-tenure option with the extra interest in rupees; it just doesn't
 * recommend it.
 */
export type Purpose =
  | 'wedding'
  | 'medical'
  | 'travel'
  | 'consumption'
  | 'vehicle'
  | 'business'
  | 'home'
  | 'refinance';

export const PRUDENT_TENURE_MONTHS: Record<Purpose, number> = {
  wedding: 36,
  medical: 36,
  travel: 36,
  consumption: 36,
  vehicle: 48,
  business: 36,
  home: 180,
  refinance: 36,
};

export const CONSUMPTION_PURPOSES: readonly Purpose[] = [
  'wedding',
  'medical',
  'travel',
  'consumption',
];

/**
 * §5/§6 tenure cap by age — a common Indian lender norm: salaried tenure is
 * generally capped at 60, self-employed/gig/informal borrowers (no fixed
 * retirement date) at 65. Applied in affordability.ts to both lenderMax's and
 * safeMax's tenure, and to the Statement's tenure trade-off table.
 */
export const RETIREMENT_AGE: Record<IncomeType, number> = {
  salaried: 60,
  self_employed: 65,
  gig: 65,
  informal: 65,
};

/**
 * Floor so a borrower already at or past their retirement age still gets a
 * computable (if short) tenure, rather than a zero/negative one breaking the
 * EMI math. Below this a loan is impractical anyway; the number itself isn't
 * load-bearing.
 */
export const MIN_TENURE_FLOOR_MONTHS = 12;

// ---------------------------------------------------------------------------
// §7  Verdict gates — ordered, first match wins, evaluated on the CAUTIOUS pass
// ---------------------------------------------------------------------------

/** Beyond this, more credit is not a solution to anything. */
export const OVERCOMMITTED_EXISTING_EMI_RATIO = 0.5;

/**
 * A bounce three weeks ago plus a new unsecured application is the profile of a
 * debt spiral. Lenders will mostly decline anyway; better to say why than to
 * let the borrower collect a rejection and a hard enquiry.
 */
export const FRESH_DISTRESS_BOUNCE_MONTHS = 3;

/**
 * Emergency savings STATED AS ZERO + pure consumption + an ask this large
 * relative to income. "Stated as" is the whole point — see
 * HARD_STOP_GATES_REQUIRE_STATED_INPUTS below.
 */
export const NO_BUFFER_CONSUMPTION_ASK_MULTIPLE = 2;

/**
 * §7.2 Roughly where regulated NBFC unsecured pricing tops out, so anything
 * above it is a distress product or an app loan, and is almost always worth
 * clearing or refinancing before taking on more.
 */
export const COSTLY_DEBT_THRESHOLD_APR = 24.0;

// ---------------------------------------------------------------------------
// §8  Stress tests
// ---------------------------------------------------------------------------

/** A lost variable component, or two bad weeks for a gig worker. */
export const STRESS_INCOME_DROP = 0.2;

/** Comparable to a full tightening cycle. Floating-rate products only. */
export const STRESS_RATE_RISE_PP = 2.0;

/** Stressed total EMI above this counts as a failure. */
export const STRESS_FAIL_EMI_RATIO = 0.5;

// ---------------------------------------------------------------------------
// §9  Unknowns — "unknown is never zero"
// ---------------------------------------------------------------------------

export type Stance = 'cautious' | 'favourable';

export interface UnknownRule<T> {
  cautious: T;
  favourable: T;
  /** Rendered verbatim to the borrower. Never rewritten in the UI. */
  why: string;
}

/**
 * Missing answers are not defaults. The engine runs end to end on both stances
 * and the two results are the band the borrower sees.
 */
export const UNKNOWNS = {
  creditScore: {
    cautious: 680,
    favourable: 760,
    why: "You didn't give a score, so we priced you between a thin file and a good one — not as a bad one. Knowing it narrows your rate band.",
  } as UnknownRule<number>,

  cardUtilisation: {
    cautious: 0.7,
    favourable: 0.1,
    why: 'We don\'t know how much of your card limit is in use. High usage prices you as stretched even at a good score.',
  } as UnknownRule<number>,

  /**
   * Expressed in MONTHS, deliberately. It resolves through
   * COMMIT_BY_SAVINGS_MONTHS exactly as a stated answer would (0 -> 0.35,
   * 6 -> 0.60). There is no separate "unknown -> fraction" path; one existed,
   * disagreed with the band table, and was removed in M1b.
   *
   * Note the cautious 0 is a SIZING device, not an assertion. Per
   * HARD_STOP_GATES_REQUIRE_STATED_INPUTS it may not fire the no-buffer gate.
   */
  emergencySavingsMonths: {
    cautious: 0,
    favourable: 6,
    why: "We don't know what you could live on if income stopped, so we've shown both the case where there's nothing behind you and the case where there's six months.",
  } as UnknownRule<number>,

  /**
   * Wide on purpose — the least reliable input in the whole model.
   *
   * Fraction of income spent on HOUSEHOLD EXPENSES as defined in RULES.md §6.1:
   * everyday running costs — food, utilities, phone, transport, school fees,
   * medical, domestic help. EXCLUDES rent and EXCLUDES existing loan EMIs, both
   * of which are subtracted separately in the surplus formula. Nothing may be
   * counted in two of those three terms.
   */
  householdExpenseRatio: {
    cautious: 0.45,
    favourable: 0.3,
    why: "You haven't told us your monthly spending, so we've assumed anywhere between 30% and 45% of income. This is the widest guess we make.",
  } as UnknownRule<number>,

  /**
   * Deliberately NOT widened. Assuming an unstated bounce would be inventing
   * distress the borrower never reported.
   */
  bounceInLast12Months: {
    cautious: false,
    favourable: false,
    why: 'You told us nothing about missed payments, so we assumed none. If there has been one, your real rate will be higher than this.',
  } as UnknownRule<boolean>,

  existingEmi: {
    cautious: 0,
    favourable: 0,
    why: 'If you said you have no EMIs, we believe you — this is the one number borrowers reliably know.',
  } as UnknownRule<number>,
} as const;

/**
 * The verdict is taken from the cautious pass only. A deliberate asymmetry: we
 * will tell someone to slow down on incomplete information, but we will not
 * tell them to go ahead on it.
 */
export const VERDICT_STANCE: Stance = 'cautious';

/**
 * §7.0 Cautious placeholders SIZE the numbers. Only STATED facts trigger a
 * hard stop.
 *
 * A §7.1 don't-borrow gate may fire only when every input its condition reads
 * was actually answered. Unknown inputs still shrink safeMax, the rate band and
 * the EMI ceiling through their cautious values — they may not by themselves
 * produce a refusal.
 *
 * Why this exists: the no-buffer gate reads `savings == 0`, and the cautious
 * placeholder for unknown savings IS 0. Without this rule, skipping one
 * optional question turns into an assertion that the borrower has no savings,
 * and Priya — 780 score, stable salary, one car EMI — gets refused outright for
 * a wedding loan. That is the "unknown is never zero" rule (UNKNOWNS above)
 * being violated at the point where it matters most, and it is the same
 * reasoning that already stops us inventing an unstated bounce.
 *
 * The engine must therefore track, per input, whether it was stated or filled.
 */
export const HARD_STOP_GATES_REQUIRE_STATED_INPUTS = true;

// ---------------------------------------------------------------------------
// §12  Language the app may not use — checkable now that engine.ts (M3)
// produces real `why` strings. Restricted to CLAIMS, not vocabulary: "safe"
// and "approve" stay usable in explanations, so these are specific outcome
// assertions, not bare words.
// ---------------------------------------------------------------------------

export const BANNED_PHRASES = [
  'guaranteed',
  'assured',
  'pre-approved',
  'will approve',
  'will sanction',
  'you will get',
  'rbi says you can afford',
] as const;
