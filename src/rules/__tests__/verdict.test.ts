import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../constants';
import { computeSafeMax } from '../affordability';
import { assessIncome } from '../income';
import { routeProduct } from '../products';
import { computeRate } from '../rate';
import { computeVerdict } from '../verdict';
import { baseAnswers } from './fixtures';

function runVerdict(answers: ReturnType<typeof baseAnswers>) {
  const routing = routeProduct(answers, (p) => computeRate(answers, p, 'cautious').band);
  const product = PRODUCTS[routing.product.value];
  const income = assessIncome(answers);
  const cautiousRate = computeRate(answers, product, 'cautious');
  const mid = (cautiousRate.band.lo + cautiousRate.band.hi) / 2;
  const safeMaxCautious = computeSafeMax(answers, income, mid, 'cautious');
  return computeVerdict({ answers, routing, income, cautiousRate, safeMaxCautious });
}

describe('§7.0 — unknown never fires a hard-stop gate (Priya\'s exact scenario)', () => {
  it('does NOT return dont_borrow when emergencySavingsMonths is simply unanswered', () => {
    const answers = baseAnswers({
      purpose: 'wedding',
      askAmount: 800_000,
      netMonthlyIncome: 110_000,
      existingEmiMonthly: 14_000,
      rent: 28_000,
      householdExpenses: 24_000,
      creditScore: 780,
      emergencySavingsMonths: undefined, // unanswered, NOT stated as 0
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).not.toBe('dont_borrow');
  });

  it('DOES fire the no-buffer gate when 0 was actually stated', () => {
    const answers = baseAnswers({
      purpose: 'wedding',
      askAmount: 800_000,
      netMonthlyIncome: 110_000,
      existingEmiMonthly: 14_000,
      rent: 28_000,
      householdExpenses: 24_000,
      creditScore: 780,
      emergencySavingsMonths: 0, // explicitly stated
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('dont_borrow');
  });
});

describe('§7.1 gates', () => {
  it('fires negative-surplus dont_borrow when the EXISTING baseline is already underwater — independent of the ask', () => {
    const answers = baseAnswers({
      netMonthlyIncome: 20_000,
      rent: 12_000,
      householdExpenses: 9_000, // rent + expenses + EMI already exceed income
      existingEmiMonthly: 500,
      askAmount: 5_000, // deliberately tiny — must still fire, since this gate is about the baseline, not the ask
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('dont_borrow');
  });

  it('does not fire the negative-surplus gate when householdExpenses was never stated', () => {
    const answers = baseAnswers({
      netMonthlyIncome: 20_000,
      rent: 12_000,
      householdExpenses: undefined,
      existingEmiMonthly: 500,
      askAmount: 500_000,
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).not.toBe('dont_borrow');
  });

  it('does NOT fire merely because a large ask would be expensive at the wrong product\'s rate (that is §7.4\'s job)', () => {
    // Positive baseline surplus, but an ask far too large for what an
    // unsecured product could support — must fall through to borrow_less /
    // different_product, not be refused outright by gate 1.
    const answers = baseAnswers({
      netMonthlyIncome: 60_000,
      rent: 15_000,
      householdExpenses: 15_000,
      existingEmiMonthly: 0,
      askAmount: 5_000_000,
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).not.toBe('dont_borrow');
  });

  it('fires over-committed dont_borrow when existing EMIs exceed 50% of true income', () => {
    const answers = baseAnswers({ netMonthlyIncome: 30_000, existingEmiMonthly: 20_000 });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('dont_borrow');
  });

  it('fires fresh-distress dont_borrow on an unsecured product with a stated bounce in the last 3 months', () => {
    const answers = baseAnswers({ bounceInLast3Months: true });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('dont_borrow');
  });

  it('does not fire fresh-distress when bounceInLast3Months was never stated', () => {
    const answers = baseAnswers({ bounceInLast3Months: undefined });
    const verdict = runVerdict(answers);
    expect(verdict.value).not.toBe('dont_borrow');
  });
});

describe('§7.2 — costlier debt (Anita\'s case)', () => {
  it('fires fix_something_first when existing debt APR beats even our worst-case quote', () => {
    const answers = baseAnswers({
      purpose: 'vehicle',
      askAmount: 150_000,
      netMonthlyIncome: 26_000,
      incomeType: 'informal',
      rent: 0,
      householdExpenses: 20_000,
      existingEmiMonthly: 3_000,
      existingDebtAPR: 32, // her app loans, 30%+
      isElectricVehicle: true,
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('fix_something_first');
    expect(verdict.why.toLowerCase()).toContain('refinance');
  });
});

describe('§7.3 — different product (Ravi\'s case)', () => {
  it('routes to different_product when Mudra applies, not borrow/borrow_less', () => {
    const answers = baseAnswers({
      purpose: 'business',
      askAmount: 1_500_000,
      netMonthlyIncome: 35_000,
      incomeType: 'self_employed',
      rent: 0,
      householdExpenses: 25_000,
      itrAnnualIncome: 420_000,
      cashMonthlyIncomeBad: 40_000,
      cashMonthlyIncomeGood: 80_000,
      collateralType: 'property',
      collateralValue: 4_500_000,
      collateralIsLivelihoodOrOnlyHome: true,
      creditScore: 'never_borrowed',
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('different_product');
  });
});

describe('§7.4 / §7.5', () => {
  it('borrow_less when the ask exceeds safeMax', () => {
    const answers = baseAnswers({ askAmount: 100_000_000 });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('borrow_less');
  });

  it('borrow when the ask is comfortably within safeMax and nothing else fires', () => {
    const answers = baseAnswers({
      netMonthlyIncome: 150_000,
      rent: 20_000,
      householdExpenses: 20_000,
      existingEmiMonthly: 0,
      askAmount: 50_000,
      emergencySavingsMonths: 6,
      creditScore: 800,
    });
    const verdict = runVerdict(answers);
    expect(verdict.value).toBe('borrow');
  });
});
