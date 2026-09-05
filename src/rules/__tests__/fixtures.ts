import type { Answers } from '../types';

/** A minimal, fully-specified salaried borrower. Override fields per test. */
export function baseAnswers(overrides: Partial<Answers> = {}): Answers {
  return {
    purpose: 'consumption',
    askAmount: 200_000,
    netMonthlyIncome: 60_000,
    incomeType: 'salaried',
    existingEmiMonthly: 0,
    rent: 15_000,
    householdExpenses: 15_000,
    creditScore: 750,
    dependents: 0,
    emergencySavingsMonths: 3,
    cardUtilisation: 0.2,
    bounceInLast12Months: false,
    bounceInLast3Months: false,
    ...overrides,
  };
}
