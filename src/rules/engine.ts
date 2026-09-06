/**
 * Orchestrates the whole pipeline. This is the ONLY module that knows about
 * the two-pass cautious/favourable loop — every other module either takes an
 * explicit `stance` argument (rate.ts, affordability.ts) or doesn't need one
 * at all (products.ts, income.ts, since none of their inputs are
 * UNKNOWNS-covered fields).
 *
 * Sequence: route the product once (stance-independent) -> assess income once
 * (stance-independent) -> run rate + lenderMax + safeMax twice, once per
 * stance -> combine the two passes into bands via min/max (never assume which
 * side is which — RULES.md's own inputs are constructed so cautious is worse
 * for the borrower, but taking the literal min/max is what actually
 * guarantees the band can't invert) -> compute the verdict from the cautious
 * pass alone (VERDICT_STANCE) -> compute the stress test from the cautious
 * pass's own numbers.
 */
import { EPS_MONEY, EPS_PERCENT, PRODUCTS, PRUDENT_TENURE_MONTHS, type Stance } from './constants';
import { computeLenderMax, computeSafeMax, computeStressTest, type SafeMaxResult } from './affordability';
import { assessIncome } from './income';
import { routeProduct } from './products';
import { aprForRate, computeRate, type PersonalRate } from './rate';
import type { Answers, Band, Explained, Outputs } from './types';
import { computeVerdict } from './verdict';

const STANCES: Stance[] = ['cautious', 'favourable'];

function band(lo: number, hi: number): Band {
  return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}

function collapsed(b: Band, epsilon: number): boolean {
  return Math.abs(b.hi - b.lo) <= epsilon;
}

/**
 * Review finding 9 follow-up: a collapsed band (cautious === favourable) can
 * happen for two genuinely different reasons, and conflating them produces a
 * false explanation. Authored here, not in the UI, per the same rule as every
 * other why string (CLAUDE.md: generated where the number is computed).
 *
 * 1. RATE PINNED — the personalised rate anchor clamps to the SAME product
 *    ceiling under both stances (rate.ts's `Math.max(base_lo, Math.min(...))`
 *    clamp), so anything downstream of the rate (lenderMax's topRatePercent,
 *    the APR) collapses too. Verified true rather than inferred: compares the
 *    two stances' actual anchor points directly.
 * 2. EVERY CONTRIBUTING INPUT STATED — safeMax/emiCeiling never touch the
 *    rate ceiling at all; their own inputs (householdExpenses,
 *    emergencySavingsMonths — the only two of their inputs with a real
 *    cautious/favourable spread; existingEmi's spread is degenerate by
 *    construction and dependents/bounce never vary the surplus formula) were
 *    simply all stated, so there was nothing left to widen for.
 *
 * When a band collapses for neither verified reason, no note is appended —
 * silence over a guessed cause.
 */
const RATE_PINNED_NOTE = 'Your profile already pins this at the product ceiling — there is no spread left to show.';
const ALL_STATED_NOTE = 'You told us everything this depends on, so there is no range left to show.';

/**
 * Which Answers fields the engine had to fill in from UNKNOWNS because they
 * were never stated. Only checks fields that actually HAVE an UNKNOWNS entry
 * or an extended two-pass treatment (rate.ts's employer/vintage fallback) —
 * fields with no documented fallback (e.g. a large upcoming expense) aren't
 * "unresolved," they simply don't move anything, which is a different gap
 * noted in the M3 report rather than surfaced here.
 */
function unresolvedInputs(answers: Answers): string[] {
  const always: (keyof Answers)[] = [
    'creditScore',
    'cardUtilisation',
    'emergencySavingsMonths',
    'householdExpenses',
    'bounceInLast12Months',
    'existingEmiMonthly',
  ];
  const conditional: (keyof Answers)[] =
    answers.incomeType === 'salaried'
      ? ['yearsAtCurrentEmployer']
      : answers.incomeType === 'self_employed'
        ? ['businessVintageYears', 'gstAndCurrentAccount']
        : [];

  return [...always, ...conditional].filter((key) => answers[key] === undefined);
}

interface Pass {
  stance: Stance;
  rate: PersonalRate;
  lenderMax: Explained<number>;
  safeMax: SafeMaxResult;
  aprPercent: number;
}

export function runEngine(answers: Answers): Outputs {
  const routing = routeProduct(answers, (p) => computeRate(answers, p, 'cautious').band);
  const product = PRODUCTS[routing.product.value];
  const income = assessIncome(answers);
  const tenure = PRUDENT_TENURE_MONTHS[answers.purpose];

  const passes: Record<Stance, Pass> = {} as Record<Stance, Pass>;
  for (const stance of STANCES) {
    const rate = computeRate(answers, product, stance);
    const midRate = (rate.band.lo + rate.band.hi) / 2;
    const lenderMax = computeLenderMax(answers, product, income, rate.band.hi, stance);
    const safeMax = computeSafeMax(answers, income, midRate, stance);
    // The stance's own anchor point (band.lo, pre-floor-widening) is its actual
    // personalised rate — that's what a fair-rate APR quote should be built on,
    // not the artificially widened band top.
    const aprPercent = aprForRate(product, answers.askAmount, rate.band.lo, tenure, stance).aprPercent;
    passes[stance] = { stance, rate, lenderMax, safeMax, aprPercent };
  }

  const cautious = passes.cautious;
  const favourable = passes.favourable;

  const verdict = computeVerdict({
    answers,
    routing,
    income,
    cautiousRate: cautious.rate,
    safeMaxCautious: cautious.safeMax,
  });

  const stress = computeStressTest(
    answers,
    product,
    cautious.safeMax,
    (cautious.rate.band.lo + cautious.rate.band.hi) / 2,
  );

  // See collapsed()/RATE_PINNED_NOTE/ALL_STATED_NOTE above.
  const ratePinned = cautious.rate.band.lo === favourable.rate.band.lo;
  const surplusInputsStated = answers.householdExpenses !== undefined && answers.emergencySavingsMonths !== undefined;

  const lenderMaxBand = band(cautious.lenderMax.value, favourable.lenderMax.value);
  const safeMaxBand = band(cautious.safeMax.safeMax.value, favourable.safeMax.safeMax.value);
  const aprBandValue = band(cautious.aprPercent, favourable.aprPercent);
  const emiCeilingBand = band(cautious.safeMax.emiCeiling.value, favourable.safeMax.emiCeiling.value);

  return {
    verdict,
    product: routing.product,
    lenderMax: {
      value: lenderMaxBand,
      why: cautious.lenderMax.why + (ratePinned && collapsed(lenderMaxBand, EPS_MONEY) ? ` ${RATE_PINNED_NOTE}` : ''),
      from: cautious.lenderMax.from,
    },
    safeMax: {
      value: safeMaxBand,
      why: cautious.safeMax.safeMax.why + (surplusInputsStated && collapsed(safeMaxBand, EPS_MONEY) ? ` ${ALL_STATED_NOTE}` : ''),
      from: cautious.safeMax.safeMax.from,
    },
    rateBand: {
      value: band(
        Math.min(cautious.rate.band.lo, favourable.rate.band.lo),
        Math.max(cautious.rate.band.hi, favourable.rate.band.hi),
      ),
      // unsecuredAvailable doesn't vary by stance for the case it flags (a
      // thin file on an unsecured product), so either pass's value is fine —
      // see rate.ts's scoreDelta. Review finding 3: this used to be computed
      // and silently discarded.
      why:
        'Base band for this product, adjusted for your score, profile, utilisation and any bounce — widened to reflect what you have and haven\'t told us.' +
        (cautious.rate.unsecuredAvailable
          ? ''
          : ' As a first-time borrower with no collateral, lenders may decline an unsecured application outright — this band prices the loan, not the odds of getting it.'),
      from: ['creditScore', 'cardUtilisation', 'bounceInLast12Months'],
    },
    aprBand: {
      value: aprBandValue,
      why:
        'The nominal rate plus processing fee and GST, expressed as one annual cost — this is the number to compare against any lender quote, not the headline rate.' +
        (ratePinned && collapsed(aprBandValue, EPS_PERCENT) ? ` ${RATE_PINNED_NOTE}` : ''),
      from: ['askAmount'],
    },
    emiCeiling: {
      value: emiCeilingBand,
      why: cautious.safeMax.emiCeiling.why + (surplusInputsStated && collapsed(emiCeilingBand, EPS_MONEY) ? ` ${ALL_STATED_NOTE}` : ''),
      from: cautious.safeMax.emiCeiling.from,
    },
    stress,
    unresolvedInputs: unresolvedInputs(answers),
  };
}
