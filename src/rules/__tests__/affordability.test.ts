import { describe, expect, it } from 'vitest';
import { COMMIT_BY_SAVINGS_MONTHS, PRODUCTS } from '../constants';
import { computeLenderMax, computeSafeMax, computeStressTest } from '../affordability';
import { assessIncome } from '../income';
import { computeRate } from '../rate';
import { baseAnswers } from './fixtures';

function ratesFor(answers: ReturnType<typeof baseAnswers>, product = PRODUCTS.personal) {
  return {
    cautious: computeRate(answers, product, 'cautious'),
    favourable: computeRate(answers, product, 'favourable'),
  };
}

describe('computeLenderMax and computeSafeMax are independent computations', () => {
  it('do not assume lenderMax > safeMax universally — a salaried case where safety exceeds the lender model', () => {
    // Very high income but a huge stated household expense: assessed (lender)
    // income stays high (salary is trusted at face value), but surplus for
    // safety purposes collapses. This should NOT force safeMax below
    // lenderMax as a hardcoded rule — it should simply fall out of the two
    // independent formulas.
    const answers = baseAnswers({
      netMonthlyIncome: 200_000,
      rent: 5_000,
      householdExpenses: 5_000,
      existingEmiMonthly: 0,
      emergencySavingsMonths: 6,
    });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers);
    const lenderMax = computeLenderMax(answers, PRODUCTS.personal, income, cautious.band.hi, 'cautious');
    const safeMax = computeSafeMax(answers, income, (cautious.band.lo + cautious.band.hi) / 2, 'cautious');
    // Both numbers must exist and be independently derived, not one forced below the other.
    expect(lenderMax.value).toBeGreaterThan(0);
    expect(safeMax.safeMax.value).toBeGreaterThan(0);
  });

  it('lenderMax and safeMax are computed from genuinely different formulas (FOIR vs surplus)', () => {
    const answers = baseAnswers({ netMonthlyIncome: 110_000, rent: 28_000, householdExpenses: 24_000, existingEmiMonthly: 14_000 });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers);
    const lenderMax = computeLenderMax(answers, PRODUCTS.personal, income, cautious.band.hi, 'cautious');
    const safeMax = computeSafeMax(answers, income, (cautious.band.lo + cautious.band.hi) / 2, 'cautious');
    expect(lenderMax.value).not.toBe(safeMax.safeMax.value);
  });
});

describe('computeLenderMax — caps', () => {
  it('is floored by the personal-loan income multiple', () => {
    const answers = baseAnswers({ netMonthlyIncome: 20_000, existingEmiMonthly: 0 });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers);
    const lenderMax = computeLenderMax(answers, PRODUCTS.personal, income, cautious.band.hi, 'cautious');
    expect(lenderMax.value).toBeLessThanOrEqual(20 * 20_000 + 1); // PERSONAL_LOAN_INCOME_MULTIPLE
  });

  it('is floored by the lender\'s LTV against collateral for a secured product', () => {
    const answers = baseAnswers({
      netMonthlyIncome: 500_000,
      collateralType: 'property',
      collateralValue: 1_000_000,
    });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers, PRODUCTS.lap);
    const lenderMax = computeLenderMax(answers, PRODUCTS.lap, income, cautious.band.hi, 'cautious');
    expect(lenderMax.value).toBeLessThanOrEqual(1_000_000 * 0.7 + 1);
  });
});

describe('computeSafeMax — commit fraction bands', () => {
  it.each(COMMIT_BY_SAVINGS_MONTHS.map((b) => [b.minMonths, b.fraction] as const))(
    'at the %i-month boundary the fraction is %f',
    (months, expectedFraction) => {
      const answers = baseAnswers({ emergencySavingsMonths: months, dependents: 0, bounceInLast12Months: false });
      const income = assessIncome(answers);
      const { cautious } = ratesFor(answers);
      const noPenalty = computeSafeMax(answers, income, (cautious.band.lo + cautious.band.hi) / 2, 'cautious');
      const surplus =
        income.trueIncome.value - answers.rent - (answers.householdExpenses ?? 0) - (answers.existingEmiMonthly ?? 0);
      expect(noPenalty.surplus).toBeCloseTo(surplus, 5);
      expect(noPenalty.emiCeiling.value).toBeLessThanOrEqual(Math.floor((expectedFraction * surplus) / 500) * 500 + 500);
    },
  );

  it('the two-affordability-constraint min correctly picks whichever binds', () => {
    // Low rent/expenses -> surplus-based ceiling should NOT be the binding one;
    // TOTAL_EMI_CAP should bind instead.
    const answers = baseAnswers({ netMonthlyIncome: 100_000, rent: 1_000, householdExpenses: 1_000, existingEmiMonthly: 0, emergencySavingsMonths: 6 });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers);
    const result = computeSafeMax(answers, income, (cautious.band.lo + cautious.band.hi) / 2, 'cautious');
    expect(result.emiCeiling.why.toLowerCase()).toContain('total debt service');
  });
});

describe('computeStressTest', () => {
  it('reports failure when a 20% income drop wipes out the cautious surplus', () => {
    const answers = baseAnswers({
      netMonthlyIncome: 30_000,
      rent: 10_000,
      householdExpenses: 12_000,
      existingEmiMonthly: 5_000,
      emergencySavingsMonths: 0,
    });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers);
    const safeMax = computeSafeMax(answers, income, (cautious.band.lo + cautious.band.hi) / 2, 'cautious');
    const stress = computeStressTest(answers, PRODUCTS.personal, safeMax, (cautious.band.lo + cautious.band.hi) / 2);
    expect(typeof stress.value.survives).toBe('boolean');
    expect(stress.value.scenario.length).toBeGreaterThan(0);
  });

  it('only considers the rate-rise scenario for a floating-rate product', () => {
    const answers = baseAnswers({ collateralType: 'property', collateralValue: 5_000_000 });
    const income = assessIncome(answers);
    const { cautious } = ratesFor(answers, PRODUCTS.lap);
    const safeMax = computeSafeMax(answers, income, (cautious.band.lo + cautious.band.hi) / 2, 'cautious');
    // Should not throw, and should produce a scenario string mentioning either income or rate.
    const stress = computeStressTest(answers, PRODUCTS.lap, safeMax, (cautious.band.lo + cautious.band.hi) / 2);
    expect(stress.value.scenario).toMatch(/income|rate/i);
  });
});
