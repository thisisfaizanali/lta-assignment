/**
 * The question graph — RULES.md §10. Pure, stance-agnostic, no React: this
 * module decides WHICH questions apply to a given borrower and WHETHER an
 * optional one is worth asking. It never computes a financial number itself
 * — every impact check runs the real engine (engine.ts) on two candidate
 * answers and diffs the real Outputs. That is deliberate: duplicating
 * money.ts/rate.ts/affordability.ts logic here would be exactly the
 * "financial logic in the question layer" this milestone must avoid.
 *
 * Two DIFFERENT kinds of "cautious/favourable" appear in this codebase, and
 * they must not be confused:
 *   - constants.ts's UNKNOWNS pairs are what the ENGINE assumes when a field
 *     is left unanswered. For two fields (bounceInLast12Months, existingEmi)
 *     that pair is deliberately collapsed to a single non-widening value
 *     ("don't invent distress/debt that was never stated") — reusing THAT
 *     pair to test whether the QUESTION is worth asking would wrongly
 *     conclude bouncing history never matters, when RULES.md §10.2 lists it
 *     as "always" worth asking, and rate.ts gives an unstated bounce a real
 *     +2.5pp adjustment once answered.
 *   - a question's own `probe` here represents the field's REAL value space
 *     (e.g. bounce: false vs true) for the sole purpose of asking "does
 *     knowing the true answer change anything" — never applied to a real
 *     borrower's own computation, only used internally to rank relevance.
 * Where a field's UNKNOWNS pair genuinely IS a real plausible-value spread
 * (cardUtilisation, emergencySavingsMonths), the probe reuses it directly
 * rather than inventing a second number.
 */
import {
  CARD_UTILISATION_HIGH,
  COSTLY_DEBT_THRESHOLD_APR,
  EPS_MONEY,
  EPS_PERCENT,
  GIG_MIN_HISTORY_MONTHS,
  PRODUCTIVE_UPLIFT_CAP_OF_INCOME,
  UNKNOWNS,
  VOLATILE_INCOME_TYPES,
  type IncomeType,
} from './constants';
import { runEngine } from './engine';
import type { Answers, Band, Outputs } from './types';

export type QuestionId = keyof Answers;
export type Tier = 'must' | 'optional';

export interface Question {
  id: QuestionId;
  tier: Tier;
  /** Short enough to read on a phone screen in one line. */
  prompt: string;
  /** One sentence: why this question exists. Shown alongside the prompt. */
  why: string;
  /** Adaptivity — §10.3. Evaluated against whatever has been answered so far. */
  appliesWhen: (answers: Partial<Answers>) => boolean;
  /**
   * Optional-tier only. Two representative extremes for THIS field's real
   * value space, used only to test relevance (see module doc comment).
   */
  probe?: (answers: Partial<Answers>) => [Partial<Answers>, Partial<Answers>];
}

/**
 * The five fields with no fallback of any kind — nothing can be computed at
 * all without them. Every other field (including the rest of the "must"
 * tier) is optional in the Answers type itself, because §7.1 already
 * requires the engine to tolerate a skipped must-question gracefully.
 */
export const HARD_REQUIRED: readonly QuestionId[] = ['purpose', 'askAmount', 'netMonthlyIncome', 'incomeType', 'rent'];

/**
 * Exported for the UI layer (M5): it needs the same "is there enough to
 * compute anything yet" check this module already makes internally, rather
 * than re-deriving HARD_REQUIRED itself. Visibility change only — no new
 * logic, no changed behaviour.
 */
export function hasBaseline(answers: Partial<Answers>): answers is Answers {
  return HARD_REQUIRED.every((key) => answers[key] !== undefined);
}

// ---------------------------------------------------------------------------
// §10.1 — the must set. All ten apply unconditionally; only the OPTIONAL set
// adapts to what's already been answered (§10.3).
// ---------------------------------------------------------------------------

export const MUST_QUESTIONS: readonly Question[] = [
  {
    id: 'purpose',
    tier: 'must',
    prompt: 'What is the loan for?',
    why: 'Purpose decides the product, and the product decides the rate band.',
    appliesWhen: () => true,
  },
  {
    id: 'askAmount',
    tier: 'must',
    prompt: 'How much do you want to borrow?',
    why: "This is what we compare against what a lender might offer and what you can safely carry.",
    appliesWhen: () => true,
  },
  {
    id: 'netMonthlyIncome',
    tier: 'must',
    prompt: 'What is your net monthly income?',
    why: 'Almost every other number is computed from this.',
    appliesWhen: () => true,
  },
  {
    id: 'incomeType',
    tier: 'must',
    prompt: 'How does that income reach you?',
    why: 'Salaried, self-employed, gig and informal income are assessed very differently by a lender.',
    appliesWhen: () => true,
  },
  {
    id: 'existingEmiMonthly',
    tier: 'must',
    prompt: 'What do your existing loan EMIs add up to each month?',
    why: "This is the single largest input to how much more you can safely take on. If you have none, say so — zero is a real answer.",
    appliesWhen: () => true,
  },
  {
    id: 'rent',
    tier: 'must',
    prompt: 'What is your monthly rent?',
    why: 'Subtracted separately from your surplus, so it is never counted twice.',
    appliesWhen: () => true,
  },
  {
    id: 'householdExpenses',
    tier: 'must',
    prompt:
      'What does your household spend in a month on everything else — food, bills, transport, school, medical? Not rent, not loan EMIs.',
    why: 'Rent and EMIs are asked separately, so nothing here should overlap with either.',
    appliesWhen: () => true,
  },
  {
    id: 'age',
    tier: 'must',
    prompt: 'How old are you?',
    why: 'Feeds tenure and product eligibility.',
    appliesWhen: () => true,
  },
  {
    id: 'creditScore',
    tier: 'must',
    prompt: "What is your credit score? Say so if you don't know it, or have never borrowed before.",
    why: 'The single biggest driver of your rate.',
    appliesWhen: () => true,
  },
  {
    id: 'dependents',
    tier: 'must',
    prompt: 'How many people depend on your income?',
    why: 'Reduces how much of your surplus we treat as genuinely spare.',
    appliesWhen: () => true,
  },
];

// ---------------------------------------------------------------------------
// §10.2 — the optional set, each with its adaptivity gate and probe.
// ---------------------------------------------------------------------------

export const OPTIONAL_QUESTIONS: readonly Question[] = [
  {
    id: 'emergencySavingsMonths',
    tier: 'optional',
    prompt: 'How many months of expenses could you cover with no income?',
    why: 'Decides how much of your surplus we are willing to commit to a new EMI.',
    appliesWhen: () => true,
    probe: () => [
      { emergencySavingsMonths: UNKNOWNS.emergencySavingsMonths.cautious },
      { emergencySavingsMonths: UNKNOWNS.emergencySavingsMonths.favourable },
    ],
  },
  {
    id: 'cardUtilisation',
    tier: 'optional',
    prompt: 'Roughly how much of your credit card limit is in use?',
    why: `Above ${CARD_UTILISATION_HIGH * 100}% utilisation, lenders price you as stretched even at a good score.`,
    appliesWhen: (a) =>
      a.creditScore === undefined || a.creditScore === 'dont_know' || (typeof a.creditScore === 'number' && a.creditScore >= 650),
    probe: () => [
      { cardUtilisation: UNKNOWNS.cardUtilisation.cautious },
      { cardUtilisation: UNKNOWNS.cardUtilisation.favourable },
    ],
  },
  {
    id: 'yearsAtCurrentEmployer',
    tier: 'optional',
    prompt: 'How many years have you been at your current employer?',
    why: 'Job stability moves your rate a little.',
    appliesWhen: (a) => a.incomeType === 'salaried',
    // 1 and 5 sit either side of rate.ts's own 3-year tenure boundary — not a new threshold.
    probe: () => [{ yearsAtCurrentEmployer: 1 }, { yearsAtCurrentEmployer: 5 }],
  },
  {
    id: 'itrAnnualIncome',
    tier: 'optional',
    prompt: 'What does your last ITR declare as annual income?',
    why: 'Lenders lend against this figure, not what the business actually takes in.',
    appliesWhen: (a) => a.incomeType === 'self_employed',
    probe: (a) => {
      const monthly = a.netMonthlyIncome ?? 0;
      return [{ itrAnnualIncome: monthly * 12 * 0.7 }, { itrAnnualIncome: monthly * 12 * 1.1 }];
    },
  },
  {
    id: 'businessVintageYears',
    tier: 'optional',
    prompt: 'How many years has the business been running?',
    why: 'Combined with GST/current-account evidence, this decides whether you are priced as documented or thin-file.',
    appliesWhen: (a) => a.incomeType === 'self_employed',
    // either side of rate.ts's own 3-year "documented" boundary
    probe: () => [{ businessVintageYears: 1 }, { businessVintageYears: 5 }],
  },
  {
    id: 'gstAndCurrentAccount',
    tier: 'optional',
    prompt: 'Do you have GST registration and a business current account?',
    why: 'The evidence a lender needs before crediting any banked cash beyond your ITR figure.',
    appliesWhen: (a) => a.incomeType === 'self_employed',
    probe: () => [{ gstAndCurrentAccount: false }, { gstAndCurrentAccount: true }],
  },
  {
    id: 'cashMonthlyIncomeBad',
    tier: 'optional',
    prompt: 'On a bad month, what does this actually bring in?',
    why: "We size your safe amount to your bad month, not your average — a bad month shouldn't mean a missed EMI.",
    appliesWhen: (a) => VOLATILE_INCOME_TYPES.includes(a.incomeType as IncomeType),
    probe: (a) => {
      const stated = a.netMonthlyIncome ?? 0;
      return [{ cashMonthlyIncomeBad: stated * 0.7 }, { cashMonthlyIncomeBad: stated * 1.1 }];
    },
  },
  {
    id: 'platformHistoryMonths',
    tier: 'optional',
    prompt: 'How many months of payout history do you have on the platform?',
    why: `Below ${GIG_MIN_HISTORY_MONTHS} months, a lender has no track record to assess yet.`,
    appliesWhen: (a) => a.incomeType === 'gig',
    probe: () => [{ platformHistoryMonths: 2 }, { platformHistoryMonths: 8 }],
  },
  {
    id: 'bounceInLast12Months',
    tier: 'optional',
    prompt: 'Has any loan EMI or cheque bounced in the last 12 months?',
    why: 'The single strongest repayment signal you can self-report.',
    appliesWhen: () => true,
    // NOT the UNKNOWNS pair (false/false) — that pair is what we assume when
    // this is left blank, not the field's real value space. See module doc.
    probe: () => [{ bounceInLast12Months: false }, { bounceInLast12Months: true }],
  },
  {
    id: 'bounceInLast3Months',
    tier: 'optional',
    prompt: 'Was that within the last 3 months?',
    why: 'A very recent bounce changes the verdict, not just the rate.',
    appliesWhen: (a) => a.bounceInLast12Months === true,
    probe: () => [{ bounceInLast3Months: false }, { bounceInLast3Months: true }],
  },
  {
    id: 'existingDebtAPR',
    tier: 'optional',
    prompt: "What's the interest rate on your costliest existing debt?",
    why: 'If it is expensive enough, clearing it first may matter more than this loan.',
    appliesWhen: (a) => (a.existingEmiMonthly ?? 0) > 0,
    // either side of the already-documented COSTLY_DEBT_THRESHOLD_APR
    probe: () => [{ existingDebtAPR: COSTLY_DEBT_THRESHOLD_APR - 1 }, { existingDebtAPR: COSTLY_DEBT_THRESHOLD_APR + 8 }],
  },
  {
    id: 'collateralType',
    tier: 'optional',
    prompt: 'Do you own property or gold you could offer as security?',
    why: 'Collateral can materially change which product and rate make sense.',
    appliesWhen: () => true,
    probe: (a) => [{}, { collateralType: 'property', collateralValue: (a.askAmount ?? 0) * 3 }],
  },
  {
    id: 'collateralValue',
    tier: 'optional',
    prompt: 'Roughly what is it worth?',
    why: 'Decides how much room that collateral actually gives you.',
    appliesWhen: (a) => a.collateralType !== undefined,
    probe: (a) => [{ collateralValue: (a.askAmount ?? 0) * 1.2 }, { collateralValue: (a.askAmount ?? 0) * 4 }],
  },
  {
    id: 'collateralIsLivelihoodOrOnlyHome',
    tier: 'optional',
    prompt: 'Is that your only home, or your sole means of earning?',
    why: "If so, we won't recommend pledging it just because it lowers the rate.",
    appliesWhen: (a) => a.collateralType !== undefined && (a.collateralValue ?? 0) > 0,
    probe: () => [{ collateralIsLivelihoodOrOnlyHome: false }, { collateralIsLivelihoodOrOnlyHome: true }],
  },
  {
    id: 'coApplicantIncome',
    tier: 'optional',
    prompt: 'Will anyone co-sign this with you?',
    why: "A co-applicant's income raises what a lender may offer in full, and your safe amount at half that.",
    appliesWhen: () => true,
    probe: (a) => [{ coApplicantIncome: 0 }, { coApplicantIncome: a.netMonthlyIncome ?? 0 }],
  },
  {
    id: 'expectedMonthlyUplift',
    tier: 'optional',
    prompt: 'If this works out, how much extra could it earn you each month?',
    why: 'We count half of this, capped, and only from the fourth month — never the full amount, and never as a guarantee.',
    appliesWhen: (a) => a.purpose === 'business' || a.purpose === 'vehicle',
    probe: (a) => [{ expectedMonthlyUplift: 0 }, { expectedMonthlyUplift: (a.netMonthlyIncome ?? 0) * PRODUCTIVE_UPLIFT_CAP_OF_INCOME }],
  },
  {
    id: 'isElectricVehicle',
    tier: 'optional',
    prompt: 'Is it electric?',
    why: 'Electric vehicles get a rate concession at most lenders.',
    appliesWhen: (a) => a.purpose === 'vehicle',
    probe: () => [{ isElectricVehicle: false }, { isElectricVehicle: true }],
  },
];

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function nextMustQuestions(answers: Partial<Answers>): Question[] {
  return MUST_QUESTIONS.filter((q) => answers[q.id] === undefined);
}

export function isMustSetComplete(answers: Partial<Answers>): boolean {
  return MUST_QUESTIONS.every((q) => answers[q.id] !== undefined);
}

function bandDiffers(a: Band, b: Band, epsilon: number): boolean {
  return Math.abs(a.lo - b.lo) > epsilon || Math.abs(a.hi - b.hi) > epsilon;
}

export interface ImpactedOutput {
  output: 'verdict' | 'product' | 'lenderMax' | 'safeMax' | 'rateBand' | 'aprBand' | 'emiCeiling';
  magnitude: number; // 0 for a categorical (verdict/product) flip, otherwise the larger of |Δlo|,|Δhi|
}

export interface Impact {
  affects: ImpactedOutput[];
  hasImpact: boolean;
}

function diffOutputs(a: Outputs, b: Outputs): Impact {
  const affects: ImpactedOutput[] = [];

  if (a.verdict.value !== b.verdict.value) affects.push({ output: 'verdict', magnitude: 0 });
  if (a.product.value !== b.product.value) affects.push({ output: 'product', magnitude: 0 });

  const moneyPairs: [ImpactedOutput['output'], Band, Band][] = [
    ['lenderMax', a.lenderMax.value, b.lenderMax.value],
    ['safeMax', a.safeMax.value, b.safeMax.value],
    ['emiCeiling', a.emiCeiling.value, b.emiCeiling.value],
  ];
  for (const [output, x, y] of moneyPairs) {
    if (bandDiffers(x, y, EPS_MONEY)) {
      affects.push({ output, magnitude: Math.max(Math.abs(x.lo - y.lo), Math.abs(x.hi - y.hi)) });
    }
  }

  const percentPairs: [ImpactedOutput['output'], Band, Band][] = [
    ['rateBand', a.rateBand.value, b.rateBand.value],
    ['aprBand', a.aprBand.value, b.aprBand.value],
  ];
  for (const [output, x, y] of percentPairs) {
    if (bandDiffers(x, y, EPS_PERCENT)) {
      affects.push({ output, magnitude: Math.max(Math.abs(x.lo - y.lo), Math.abs(x.hi - y.hi)) });
    }
  }

  return { affects, hasImpact: affects.length > 0 };
}

/**
 * Runs the real engine on the question's two probe extremes (everything else
 * held at the current answers) and diffs the real Outputs. Returns
 * hasImpact: false, affects: [] when the baseline (hard-required fields)
 * isn't there yet to compute against — there's nothing to rank without it.
 */
export function questionImpact(question: Question, answers: Partial<Answers>): Impact {
  if (!question.probe || !hasBaseline(answers)) {
    return { affects: [], hasImpact: false };
  }
  const [lowPatch, highPatch] = question.probe(answers);
  const low = runEngine({ ...answers, ...lowPatch });
  const high = runEngine({ ...answers, ...highPatch });
  return diffOutputs(low, high);
}

export interface RankedQuestion {
  question: Question;
  impact: Impact;
}

/**
 * Optional questions that (a) apply per §10.3's adaptivity, (b) are
 * unanswered, and (c) provably move at least one output for THIS borrower —
 * sorted by impact magnitude, largest first. RULES.md §10: "every additional
 * question must move a number or it is not shown" — enforced here, not
 * promised.
 */
export function applicableOptionalQuestions(answers: Partial<Answers>): RankedQuestion[] {
  if (!hasBaseline(answers)) return [];

  return OPTIONAL_QUESTIONS.filter((q) => answers[q.id] === undefined && q.appliesWhen(answers))
    .map((question) => ({ question, impact: questionImpact(question, answers) }))
    .filter((ranked) => ranked.impact.hasImpact)
    .sort((a, b) => {
      const magA = Math.max(0, ...a.impact.affects.map((x) => x.magnitude));
      const magB = Math.max(0, ...b.impact.affects.map((x) => x.magnitude));
      return magB - magA;
    });
}
