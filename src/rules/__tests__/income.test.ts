import { describe, expect, it } from 'vitest';
import { assessIncome } from '../income';
import { baseAnswers } from './fixtures';

describe('assessIncome — salaried', () => {
  it('assessed income equals stated income at face value, and trueIncome matches', () => {
    const income = assessIncome(baseAnswers({ netMonthlyIncome: 110_000 }));
    expect(income.assessedIncome.value).toBe(110_000);
    expect(income.trueIncome.value).toBe(110_000);
  });
});

describe('assessIncome — self-employed', () => {
  it('falls back to stated net income when no ITR figure is given', () => {
    const income = assessIncome(
      baseAnswers({ incomeType: 'self_employed', netMonthlyIncome: 45_000, itrAnnualIncome: undefined }),
    );
    expect(income.assessedIncome.value).toBe(45_000);
  });

  it('assesses ITR/12 with no add-back when GST+account evidence is missing', () => {
    const income = assessIncome(
      baseAnswers({
        incomeType: 'self_employed',
        itrAnnualIncome: 420_000,
        cashMonthlyIncomeBad: 40_000,
        gstAndCurrentAccount: false,
      }),
    );
    expect(income.assessedIncome.value).toBeCloseTo(35_000, 0);
  });

  it('adds a partial credit for the banked cash gap when GST+account evidence exists', () => {
    const income = assessIncome(
      baseAnswers({
        incomeType: 'self_employed',
        itrAnnualIncome: 420_000, // 35,000/month
        cashMonthlyIncomeBad: 40_000,
        gstAndCurrentAccount: true,
      }),
    );
    // 35,000 + 0.25 * (40,000 - 35,000) = 36,250
    expect(income.assessedIncome.value).toBeCloseTo(36_250, 0);
  });

  it('true income is the stated bad-month cash figure, not the ITR figure', () => {
    const income = assessIncome(
      baseAnswers({
        incomeType: 'self_employed',
        itrAnnualIncome: 420_000,
        cashMonthlyIncomeBad: 40_000,
        cashMonthlyIncomeGood: 80_000,
      }),
    );
    expect(income.trueIncome.value).toBe(40_000);
  });
});

describe('assessIncome — gig', () => {
  it('assesses zero without 6+ months of platform history', () => {
    const income = assessIncome(baseAnswers({ incomeType: 'gig', platformHistoryMonths: 2 }));
    expect(income.assessedIncome.value).toBe(0);
  });

  it('assesses zero when history length was never stated', () => {
    const income = assessIncome(baseAnswers({ incomeType: 'gig', platformHistoryMonths: undefined }));
    expect(income.assessedIncome.value).toBe(0);
  });

  it('assesses 70% of stated income once 6+ months of history exists', () => {
    const income = assessIncome(baseAnswers({ incomeType: 'gig', netMonthlyIncome: 28_000, platformHistoryMonths: 8 }));
    expect(income.assessedIncome.value).toBeCloseTo(19_600, 0);
  });
});

describe('assessIncome — informal', () => {
  it('assesses 50% of stated income', () => {
    const income = assessIncome(baseAnswers({ incomeType: 'informal', netMonthlyIncome: 26_000 }));
    expect(income.assessedIncome.value).toBeCloseTo(13_000, 0);
  });
});

describe('assessIncome — productive uplift', () => {
  it('is zero when no uplift was stated', () => {
    const income = assessIncome(baseAnswers());
    expect(income.productiveUplift.value).toBe(0);
  });

  it('haircuts the stated uplift by 50%', () => {
    const income = assessIncome(baseAnswers({ netMonthlyIncome: 26_000, expectedMonthlyUplift: 4_000 }));
    expect(income.productiveUplift.value).toBe(2_000);
  });

  it('caps the uplift at 30% of true income', () => {
    const income = assessIncome(baseAnswers({ netMonthlyIncome: 26_000, expectedMonthlyUplift: 40_000 }));
    // haircut = 20,000, cap = 0.3*26,000 = 7,800 -> capped
    expect(income.productiveUplift.value).toBeCloseTo(7_800, 0);
  });
});

describe('assessIncome — co-applicant', () => {
  it('adds full weight for the lender number, half for the safety number', () => {
    const income = assessIncome(baseAnswers({ coApplicantIncome: 20_000 }));
    expect(income.coApplicant.value.lenderAddOn).toBe(20_000);
    expect(income.coApplicant.value.safetyAddOn).toBe(10_000);
  });
});
