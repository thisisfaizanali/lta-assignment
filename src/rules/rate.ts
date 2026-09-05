/**
 * Rate construction — RULES.md §4. A personalised rate is a single point
 * anchored at the product's base-band floor plus a sum of {delta, why}
 * adjustments (§4.1's own words: "chosen to land inside the published ranges
 * when applied to the product's base band" — i.e. deltas ADD UP FROM THE
 * FLOOR, they don't shift the whole band). That point is then widened to a
 * band of width BAND_FLOOR_WIDTH_PP (§4.3: "even a fully-answered profile
 * does not get a point estimate"), clamped so it never exceeds the product's
 * own documented worst-tier ceiling.
 *
 * This runs ONCE PER STANCE. engine.ts calls it twice (cautious, favourable)
 * and combines the two per-stance bands into the customer-facing rate band —
 * this module only ever sees one stance at a time.
 */
import {
  BAND_FLOOR_WIDTH_PP,
  CARD_UTILISATION_HIGH,
  CARD_UTILISATION_LOW,
  EV_RATE_CONCESSION,
  FEE_FLAT_ALTERNATIVE,
  RATE_ADJUSTMENTS,
  SCORE_TIERS,
  THIN_FILE_DELTA_SECURED,
  THIN_FILE_UNSECURED_AVAILABLE,
  UNKNOWNS,
  type Product,
  type Stance,
} from './constants';
import { resolveUnknown, type Answers, type Band } from './types';
import { aprWithFees } from './money';
import type { AprResult } from './types';

interface Delta {
  label: string;
  value: number;
}

function scoreTierDelta(score: number): number {
  const tier = SCORE_TIERS.find((t) => score >= t.min);
  return tier ? tier.delta : SCORE_TIERS[SCORE_TIERS.length - 1].delta;
}

/**
 * Handles all three shapes of `creditScore` (a stated number, 'dont_know',
 * 'never_borrowed', or genuinely unanswered — treated the same as
 * 'dont_know', since RULES.md never distinguishes "silently skipped" from
 * "explicitly ticked don't know"). 'never_borrowed' is NOT run through the
 * cautious/favourable UNKNOWNS pair — it's a structurally different pricing
 * rule (§4.1), not a guess between two numbers.
 */
function scoreDelta(
  creditScore: Answers['creditScore'],
  secured: boolean,
  stance: Stance,
): { delta: number; why: string; unsecuredAvailable: boolean } {
  if (creditScore === 'never_borrowed') {
    return {
      delta: secured ? THIN_FILE_DELTA_SECURED : 0,
      why: secured
        ? "You've never borrowed before, so there's no repayment history to price — collateral is what makes this loan possible at all."
        : 'As a first-time borrower with no collateral, lenders may decline an unsecured application outright regardless of the rate quoted here.',
      unsecuredAvailable: THIN_FILE_UNSECURED_AVAILABLE,
    };
  }

  if (typeof creditScore === 'number') {
    return {
      delta: scoreTierDelta(creditScore),
      why: `A score of ${creditScore} places you in the ${SCORE_TIERS.find((t) => creditScore >= t.min)?.label ?? 'lowest'} band.`,
      unsecuredAvailable: true,
    };
  }

  // 'dont_know' or genuinely unanswered
  const resolved = resolveUnknown(undefined, UNKNOWNS.creditScore, stance);
  return { delta: scoreTierDelta(resolved.value), why: resolved.why, unsecuredAvailable: true };
}

/**
 * §4.2's profile-adjustment table names two dimensions (employer size,
 * document completeness) but RULES.md's own §10 question set only collects
 * one of each (years at employer; GST+account+vintage) — see the M3 report
 * for the full reasoning. Resolved here as: employer delta from tenure alone
 * (>=3y -> tenured bucket); self-employed "documented" bucket requires
 * GST+account AND vintage>=3y, otherwise "thin docs". Where the deciding
 * input (tenure/vintage) was never stated, this is run as a genuine two-pass
 * unknown — cautious gets the worse bucket, favourable the better one —
 * extending §9's own stated principle to two fields it didn't formalise,
 * using only deltas that already exist in RATE_ADJUSTMENTS.
 */
function profileDelta(answers: Answers, stance: Stance): Delta {
  switch (answers.incomeType) {
    case 'salaried': {
      if (answers.yearsAtCurrentEmployer === undefined) {
        const tenured = stance === 'favourable';
        return {
          label: tenured
            ? 'Employer tenure unknown — priced as if stable (best case)'
            : 'Employer tenure unknown — priced as if new (cautious case)',
          value: tenured ? RATE_ADJUSTMENTS.employerLargeTenured : RATE_ADJUSTMENTS.employerSmallOrNew,
        };
      }
      const tenured = answers.yearsAtCurrentEmployer >= 3;
      return {
        label: tenured ? '3+ years at current employer' : 'Under 3 years at current employer',
        value: tenured ? RATE_ADJUSTMENTS.employerLargeTenured : RATE_ADJUSTMENTS.employerSmallOrNew,
      };
    }
    case 'self_employed': {
      const hasEvidence = answers.gstAndCurrentAccount === true;
      if (answers.businessVintageYears === undefined) {
        const documented = stance === 'favourable' && hasEvidence;
        return {
          label: documented
            ? 'Business vintage unknown — priced as documented (best case)'
            : 'Business vintage unknown or documentation incomplete — priced as thin file (cautious case)',
          value: documented ? RATE_ADJUSTMENTS.selfEmployedDocumented : RATE_ADJUSTMENTS.selfEmployedThinDocs,
        };
      }
      const documented = hasEvidence && answers.businessVintageYears >= 3;
      return {
        label: documented ? 'GST-registered, banked, 3+ years vintage' : 'Incomplete business documentation',
        value: documented ? RATE_ADJUSTMENTS.selfEmployedDocumented : RATE_ADJUSTMENTS.selfEmployedThinDocs,
      };
    }
    case 'gig':
      return { label: 'Gig income, documented payout history', value: RATE_ADJUSTMENTS.gigDocumented };
    case 'informal':
      return { label: 'Informal, undocumented income', value: RATE_ADJUSTMENTS.informalUndocumented };
  }
}

function cardUtilisationDelta(answers: Answers, stance: Stance): Delta {
  const resolved = resolveUnknown(answers.cardUtilisation, UNKNOWNS.cardUtilisation, stance);
  const value =
    resolved.value > CARD_UTILISATION_HIGH
      ? RATE_ADJUSTMENTS.cardUtilisationHigh
      : resolved.value >= CARD_UTILISATION_LOW
        ? RATE_ADJUSTMENTS.cardUtilisationMid
        : RATE_ADJUSTMENTS.cardUtilisationLow;
  return { label: resolved.stated ? 'Card utilisation, as stated' : 'Card utilisation unknown', value };
}

function bounceDelta(answers: Answers, stance: Stance): Delta {
  const resolved = resolveUnknown(answers.bounceInLast12Months, UNKNOWNS.bounceInLast12Months, stance);
  return {
    label: resolved.value ? 'A bounce in the last 12 months' : 'No bounce in the last 12 months',
    value: resolved.value ? RATE_ADJUSTMENTS.bounceIn12Months : 0,
  };
}

function ltvDelta(product: Product, answers: Answers): Delta {
  if (!product.secured || !answers.collateralValue) {
    return { label: 'Unsecured — no LTV adjustment', value: 0 };
  }
  const ltv = answers.askAmount / answers.collateralValue;
  if (ltv > 0.7) return { label: `LTV ${(ltv * 100).toFixed(0)}% — thin equity cushion`, value: RATE_ADJUSTMENTS.ltvAbove70 };
  if (ltv <= 0.5) return { label: `LTV ${(ltv * 100).toFixed(0)}% — large equity cushion`, value: RATE_ADJUSTMENTS.ltvBelow50 };
  return { label: `LTV ${(ltv * 100).toFixed(0)}%`, value: 0 };
}

export interface PersonalRate {
  band: Band; // percent
  deltas: Delta[];
}

/**
 * One stance's personalised rate band. `base.lo + sum(deltas)` anchors the
 * point; the band is that point widened by BAND_FLOOR_WIDTH_PP, clamped so it
 * never exceeds the product's own [lo, hi] — §2's table header calls that
 * range "best -> worst tier", so the worst tier IS the ceiling.
 */
export function computeRate(answers: Answers, product: Product, stance: Stance): PersonalRate {
  const secured = product.secured;
  const score = scoreDelta(answers.creditScore, secured, stance);
  const profile = profileDelta(answers, stance);
  const cardUtil = cardUtilisationDelta(answers, stance);
  const bounce = bounceDelta(answers, stance);
  const ltv = ltvDelta(product, answers);
  const ev = product.id === 'twowheeler_ev' && answers.isElectricVehicle ? EV_RATE_CONCESSION : 0;

  const deltas: Delta[] = [
    { label: score.why, value: score.delta },
    profile,
    cardUtil,
    bounce,
    ltv,
    ...(ev !== 0 ? [{ label: 'Electric vehicle concession', value: ev }] : []),
  ];

  const sum = deltas.reduce((total, d) => total + d.value, 0);
  const [base_lo, base_hi] = product.rateBase;

  let anchor = base_lo + sum;
  anchor = Math.max(base_lo, Math.min(anchor, base_hi - BAND_FLOOR_WIDTH_PP));

  return { band: { lo: anchor, hi: anchor + BAND_FLOOR_WIDTH_PP }, deltas };
}

/**
 * §4.4's fee range applies only to the personal-loan case it was sourced
 * from (HDFC's flat fee is documented specifically for personal loans). For
 * every other product, the same fee figure is used for both the cautious and
 * favourable fee scenario — RULES.md doesn't document a fee-range phenomenon
 * for them.
 */
export function feeForStance(product: Product, principal: number, stance: Stance): number {
  const pctFee = Math.min(
    Math.max(principal * product.feePct, product.feeMin ?? 0),
    product.feeCap ?? Infinity,
  );
  if (product.id === 'personal' && stance === 'favourable') {
    return Math.min(pctFee, FEE_FLAT_ALTERNATIVE);
  }
  return pctFee;
}

/** APR for a specific rate point and stance's fee scenario, per RULES.md §4.4. */
export function aprForRate(
  product: Product,
  principal: number,
  ratePercent: number,
  months: number,
  stance: Stance,
): AprResult {
  return aprWithFees({
    principal,
    annualRatePercent: ratePercent,
    months,
    processingFee: feeForStance(product, principal, stance),
  });
}
