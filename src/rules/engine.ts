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
import { PRODUCTS, PRUDENT_TENURE_MONTHS, type Stance } from './constants';
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

  return {
    verdict,
    product: routing.product,
    lenderMax: {
      value: band(cautious.lenderMax.value, favourable.lenderMax.value),
      why: cautious.lenderMax.why,
      from: cautious.lenderMax.from,
    },
    safeMax: {
      value: band(cautious.safeMax.safeMax.value, favourable.safeMax.safeMax.value),
      why: cautious.safeMax.safeMax.why,
      from: cautious.safeMax.safeMax.from,
    },
    rateBand: {
      value: band(
        Math.min(cautious.rate.band.lo, favourable.rate.band.lo),
        Math.max(cautious.rate.band.hi, favourable.rate.band.hi),
      ),
      why: 'Base band for this product, adjusted for your score, profile, utilisation and any bounce — widened to reflect what you have and haven\'t told us.',
      from: ['creditScore', 'cardUtilisation', 'bounceInLast12Months'],
    },
    aprBand: {
      value: band(cautious.aprPercent, favourable.aprPercent),
      why: 'The nominal rate plus processing fee and GST, expressed as one annual cost — this is the number to compare against any lender quote, not the headline rate.',
      from: ['askAmount'],
    },
    emiCeiling: {
      value: band(cautious.safeMax.emiCeiling.value, favourable.safeMax.emiCeiling.value),
      why: cautious.safeMax.emiCeiling.why,
      from: cautious.safeMax.emiCeiling.from,
    },
    stress,
    unresolvedInputs: unresolvedInputs(answers),
  };
}
