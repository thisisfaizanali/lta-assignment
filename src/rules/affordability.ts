/**
 * RULES.md §5 (lenderMax) and §6 (safeMax) — the two numbers that must never
 * be the same thing. Both run once per stance; engine.ts calls each twice and
 * takes the min/max across the two passes to build the final bands.
 */
import {
  COMMIT_BY_SAVINGS_MONTHS,
  COMMIT_CEILING,
  COMMIT_FLOOR,
  COMMIT_PENALTIES,
  DEPENDENTS_PENALTY_THRESHOLD,
  EMI_CEILING_ROUNDING,
  FOIR,
  FOIR_ABSOLUTE_CAP,
  FOIR_HIGH_INCOME_THRESHOLD,
  FOIR_SECURED_BONUS,
  PERSONAL_LOAN_INCOME_MULTIPLE,
  PRUDENT_TENURE_MONTHS,
  STRESS_FAIL_EMI_RATIO,
  STRESS_INCOME_DROP,
  STRESS_RATE_RISE_PP,
  TOTAL_EMI_CAP,
  UNKNOWNS,
  VOLATILE_INCOME_TYPES,
  type Product,
  type Stance,
} from './constants';
import { lenderLtvFor } from './products';
import { principalFromEmi } from './money';
import { resolveUnknown, type Answers, type Explained } from './types';
import type { IncomeAssessment } from './income';

/** §5's FOIR selection, before the secured bonus and absolute cap. */
function baseFoir(answers: Answers): number {
  switch (answers.incomeType) {
    case 'salaried':
      return answers.netMonthlyIncome >= FOIR_HIGH_INCOME_THRESHOLD ? FOIR.salariedHighIncome : FOIR.salariedLowIncome;
    case 'self_employed':
      return FOIR.selfEmployed;
    case 'gig':
      return FOIR.gig;
    case 'informal':
      return FOIR.informal;
  }
}

export function computeLenderMax(
  answers: Answers,
  product: Product,
  income: IncomeAssessment,
  topRatePercent: number,
  stance: Stance,
): Explained<number> {
  const foir = Math.min(baseFoir(answers) + (product.secured ? FOIR_SECURED_BONUS : 0), FOIR_ABSOLUTE_CAP);
  const existingEmi = resolveUnknown(answers.existingEmiMonthly, UNKNOWNS.existingEmi, stance);
  const lenderIncome = income.assessedIncome.value + income.coApplicant.value.lenderAddOn;

  const availableEmi = Math.max(0, foir * lenderIncome - existingEmi.value);
  const tenure =
    answers.incomeType === 'self_employed' ? product.maxTenureMonthsSelfEmployed ?? product.maxTenureMonths : product.maxTenureMonths;

  let principal = availableEmi > 0 ? principalFromEmi(availableEmi, topRatePercent, tenure) : 0;

  const caps: string[] = [];
  if (product.id === 'personal') {
    const incomeMultipleCap = PERSONAL_LOAN_INCOME_MULTIPLE * lenderIncome;
    if (incomeMultipleCap < principal) caps.push(`${PERSONAL_LOAN_INCOME_MULTIPLE}x monthly income`);
    principal = Math.min(principal, incomeMultipleCap);
  }
  if (product.amountCap < principal) caps.push('the product amount cap');
  principal = Math.min(principal, product.amountCap);

  if (product.secured && answers.collateralValue) {
    const ltvCap = lenderLtvFor(product, answers.collateralValue) * answers.collateralValue;
    if (ltvCap < principal) caps.push('what a lender will lend against your collateral');
    principal = Math.min(principal, ltvCap);
  }

  return {
    value: Math.max(0, principal),
    why: `Modelled from a ${(foir * 100).toFixed(0)}% FOIR on your ${product.secured ? 'secured' : 'unsecured'} eligibility, at the top of your rate band over ${tenure} months${caps.length ? `, floored by ${caps.join(' and ')}` : ''}. This is a model of likely lender behaviour, not a sanction.`,
    from: ['netMonthlyIncome', 'incomeType', 'existingEmiMonthly', 'collateralValue'],
  };
}

/** §6.2's commit fraction: the savings-based band plus stacked penalties, clamped. */
function commitFraction(answers: Answers, stance: Stance): Explained<number> {
  const savings = resolveUnknown(answers.emergencySavingsMonths, UNKNOWNS.emergencySavingsMonths, stance);
  const clampedMonths = Math.max(0, savings.value);
  const band = COMMIT_BY_SAVINGS_MONTHS.find((b) => clampedMonths >= b.minMonths) ?? COMMIT_BY_SAVINGS_MONTHS[COMMIT_BY_SAVINGS_MONTHS.length - 1];

  let fraction: number = band.fraction;
  const notes: string[] = [`${savings.stated ? '' : 'unknown '}${clampedMonths} months of savings -> ${(band.fraction * 100).toFixed(0)}%`];

  if (VOLATILE_INCOME_TYPES.includes(answers.incomeType)) {
    fraction += COMMIT_PENALTIES.volatileIncome;
    notes.push('volatile income');
  }
  if ((answers.dependents ?? 0) >= DEPENDENTS_PENALTY_THRESHOLD) {
    fraction += COMMIT_PENALTIES.threeOrMoreDependents;
    notes.push(`${answers.dependents} dependents`);
  }
  const bounce = resolveUnknown(answers.bounceInLast12Months, UNKNOWNS.bounceInLast12Months, stance);
  if (bounce.value) {
    fraction += COMMIT_PENALTIES.bounceIn12Months;
    notes.push('a recent bounce');
  }

  fraction = Math.min(COMMIT_CEILING, Math.max(COMMIT_FLOOR, fraction));

  return { value: fraction, why: `Committable share of your surplus: ${notes.join(', ')}.`, from: ['emergencySavingsMonths', 'dependents', 'bounceInLast12Months'] };
}

export interface SafeMaxResult {
  safeMax: Explained<number>;
  emiCeiling: Explained<number>;
  surplus: number;
  trueIncomeForSurplus: number;
  householdExpenses: number;
  existingEmi: number;
}

/**
 * §6.1's surplus formula is `trueIncome - rent - householdExpenses -
 * existingEMIs`, unchanged here. A co-applicant's stated income is folded in
 * at its 50% safety weight (§3 frames it as part of income assessment, and
 * it's a real, verifiable figure — unlike the productive uplift, which is
 * kept out of this formula entirely because it's speculative; see
 * verdict.ts for where the uplift actually gets used).
 */
export function computeSafeMax(
  answers: Answers,
  income: IncomeAssessment,
  midRatePercent: number,
  stance: Stance,
): SafeMaxResult {
  const householdExpensesResolved =
    answers.householdExpenses !== undefined
      ? { value: answers.householdExpenses, stated: true }
      : {
          value:
            (stance === 'cautious' ? UNKNOWNS.householdExpenseRatio.cautious : UNKNOWNS.householdExpenseRatio.favourable) *
            income.trueIncome.value,
          stated: false,
        };
  const existingEmi = resolveUnknown(answers.existingEmiMonthly, UNKNOWNS.existingEmi, stance);

  const trueIncomeForSurplus = income.trueIncome.value + income.coApplicant.value.safetyAddOn;
  const surplus = trueIncomeForSurplus - answers.rent - householdExpensesResolved.value - existingEmi.value;

  const commit = commitFraction(answers, stance);
  const surplusCeiling = Math.max(0, commit.value * surplus);
  const totalEmiCeiling = Math.max(0, TOTAL_EMI_CAP * trueIncomeForSurplus - existingEmi.value);
  const rawCeiling = Math.min(surplusCeiling, totalEmiCeiling);
  const emiCeiling = Math.floor(rawCeiling / EMI_CEILING_ROUNDING) * EMI_CEILING_ROUNDING;

  const tenure = PRUDENT_TENURE_MONTHS[answers.purpose];
  const safeMaxValue = emiCeiling > 0 ? principalFromEmi(emiCeiling, midRatePercent, tenure) : 0;

  return {
    safeMax: {
      value: safeMaxValue,
      why: `Half your committable surplus (${commit.why.toLowerCase()}), or ${(TOTAL_EMI_CAP * 100).toFixed(0)}% of your true income minus existing EMIs — whichever is tighter — over a ${tenure}-month term at the middle of your rate band.`,
      from: ['netMonthlyIncome', 'rent', 'householdExpenses', 'existingEmiMonthly', 'emergencySavingsMonths'],
    },
    emiCeiling: {
      value: emiCeiling,
      why:
        surplusCeiling <= totalEmiCeiling
          ? `${(commit.value * 100).toFixed(0)}% of your surplus is the binding limit — it protects what's left over each month.`
          : `${(TOTAL_EMI_CAP * 100).toFixed(0)}% of your true income is the binding limit — it caps total debt service regardless of how much surplus you have.`,
      from: ['netMonthlyIncome', 'rent', 'householdExpenses', 'existingEmiMonthly'],
    },
    surplus,
    trueIncomeForSurplus,
    householdExpenses: householdExpensesResolved.value,
    existingEmi: existingEmi.value,
  };
}

/**
 * §8: exactly one stress case, whichever fails harder. Evaluated on the
 * CAUTIOUS pass's own numbers (the same stance the verdict uses), against the
 * cautious pass's own emiCeiling — "the EMI you'd actually agree to."
 */
export function computeStressTest(
  answers: Answers,
  product: Product,
  safeMaxCautious: SafeMaxResult,
  midRatePercent: number,
): Explained<{ survives: boolean; scenario: string }> {
  const incomeDropIncome = safeMaxCautious.trueIncomeForSurplus * (1 - STRESS_INCOME_DROP);
  const incomeDropSurplus = incomeDropIncome - answers.rent - safeMaxCautious.householdExpenses - safeMaxCautious.existingEmi;
  const incomeDropPostEmi = incomeDropSurplus - safeMaxCautious.emiCeiling.value;
  const incomeDropRatio = (safeMaxCautious.existingEmi + safeMaxCautious.emiCeiling.value) / incomeDropIncome;
  const incomeDropFails = incomeDropPostEmi < 0 || incomeDropRatio > STRESS_FAIL_EMI_RATIO;
  const incomeDropShortfall = -incomeDropPostEmi;

  let rateRiseShortfall = -Infinity;
  let rateRiseFails = false;
  if (product.floating && safeMaxCautious.safeMax.value > 0) {
    const stressedRate = midRatePercent + STRESS_RATE_RISE_PP;
    const tenure = PRUDENT_TENURE_MONTHS[answers.purpose];
    const stressedEmi = safeMaxCautious.safeMax.value * (stressedRate / 100 / 12) * Math.pow(1 + stressedRate / 100 / 12, tenure) / (Math.pow(1 + stressedRate / 100 / 12, tenure) - 1);
    const postEmi = safeMaxCautious.surplus - stressedEmi;
    rateRiseFails = postEmi < 0 || (safeMaxCautious.existingEmi + stressedEmi) / safeMaxCautious.trueIncomeForSurplus > STRESS_FAIL_EMI_RATIO;
    rateRiseShortfall = -postEmi;
  }

  const useRateRise = rateRiseShortfall > incomeDropShortfall;
  const survives = useRateRise ? !rateRiseFails : !incomeDropFails;
  const scenario = useRateRise
    ? `If your rate rose by ${STRESS_RATE_RISE_PP}pp, ${survives ? 'you would still cover the EMI.' : 'you would come up short each month.'}`
    : `If your income dropped ${(STRESS_INCOME_DROP * 100).toFixed(0)}%, ${survives ? 'you would still cover the EMI.' : 'you would come up short each month.'}`;

  return {
    value: { survives, scenario },
    why: scenario,
    from: ['netMonthlyIncome', 'rent', 'householdExpenses', 'existingEmiMonthly'],
  };
}
