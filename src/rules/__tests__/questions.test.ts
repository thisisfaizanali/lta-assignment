import { describe, expect, it } from 'vitest';
import {
  MUST_QUESTIONS,
  OPTIONAL_QUESTIONS,
  applicableOptionalQuestions,
  isMustSetComplete,
  nextMustQuestions,
  questionImpact,
} from '../questions';
import type { Answers } from '../types';

// Mirrors personas.test.ts's fixtures (M3). Duplicated rather than imported
// to avoid touching the already-committed M3 test file for an M4 concern.
const priya: Answers = {
  purpose: 'wedding',
  askAmount: 800_000,
  netMonthlyIncome: 110_000,
  incomeType: 'salaried',
  existingEmiMonthly: 14_000,
  rent: 28_000,
  householdExpenses: 24_000,
  age: 29,
  creditScore: 780,
  dependents: 0,
  yearsAtCurrentEmployer: 5,
};

const ravi: Answers = {
  purpose: 'business',
  askAmount: 1_500_000,
  netMonthlyIncome: 35_000,
  incomeType: 'self_employed',
  existingEmiMonthly: 0,
  rent: 0,
  age: 42,
  creditScore: 'never_borrowed',
  dependents: 1,
  itrAnnualIncome: 420_000,
  businessVintageYears: 14,
  gstAndCurrentAccount: true,
  cashMonthlyIncomeBad: 40_000,
  cashMonthlyIncomeGood: 80_000,
  collateralType: 'property',
  collateralValue: 4_500_000,
  collateralIsLivelihoodOrOnlyHome: true,
};

const anita: Answers = {
  purpose: 'vehicle',
  askAmount: 150_000,
  netMonthlyIncome: 26_000,
  incomeType: 'informal',
  existingEmiMonthly: 3_000,
  rent: 0,
  householdExpenses: 20_000,
  age: 35,
  creditScore: undefined,
  dependents: 3,
  emergencySavingsMonths: 0,
  existingDebtAPR: 32,
  bounceInLast12Months: true,
  bounceInLast3Months: true,
  isElectricVehicle: true,
};

describe('required questions', () => {
  it('lists exactly the ten §10.1 must-questions', () => {
    expect(MUST_QUESTIONS).toHaveLength(10);
    expect(MUST_QUESTIONS.map((q) => q.id)).toEqual([
      'purpose',
      'askAmount',
      'netMonthlyIncome',
      'incomeType',
      'existingEmiMonthly',
      'rent',
      'householdExpenses',
      'age',
      'creditScore',
      'dependents',
    ]);
  });

  it('nextMustQuestions returns only the unanswered ones', () => {
    const partial: Partial<Answers> = { purpose: 'wedding', askAmount: 100_000 };
    const remaining = nextMustQuestions(partial);
    expect(remaining).toHaveLength(8);
    expect(remaining.map((q) => q.id)).not.toContain('purpose');
    expect(remaining.map((q) => q.id)).not.toContain('askAmount');
  });

  it('isMustSetComplete is true only once all ten are answered', () => {
    expect(isMustSetComplete({})).toBe(false);
    expect(isMustSetComplete(priya)).toBe(true);
  });

  it('never asks known excluded optional questions with no engine consumer', () => {
    const ids = OPTIONAL_QUESTIONS.map((q) => q.id);
    // cashMonthlyIncomeGood is stored but never read by income.ts/engine.ts;
    // an existing-lender-quote and a large-upcoming-expense question have no
    // Answers field or engine consumer at all in M3 — none belong here.
    expect(ids).not.toContain('cashMonthlyIncomeGood');
    expect(ids).not.toContain('existingLenderQuote');
    expect(ids).not.toContain('upcomingLargeExpense');
  });
});

describe('conditional branching — §10.3 adaptivity', () => {
  it('offers employer tenure to a salaried borrower, not self-employed/gig/informal fields', () => {
    const applicable = OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(priya));
    const ids = applicable.map((q) => q.id);
    expect(ids).toContain('yearsAtCurrentEmployer');
    expect(ids).not.toContain('itrAnnualIncome');
    expect(ids).not.toContain('businessVintageYears');
    expect(ids).not.toContain('gstAndCurrentAccount');
    expect(ids).not.toContain('platformHistoryMonths');
    expect(ids).not.toContain('cashMonthlyIncomeBad');
  });

  it('offers ITR/vintage/GST/bad-month to a self-employed borrower, not employer tenure', () => {
    const applicable = OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(ravi));
    const ids = applicable.map((q) => q.id);
    expect(ids).toEqual(
      expect.arrayContaining(['itrAnnualIncome', 'businessVintageYears', 'gstAndCurrentAccount', 'cashMonthlyIncomeBad']),
    );
    expect(ids).not.toContain('yearsAtCurrentEmployer');
    expect(ids).not.toContain('platformHistoryMonths');
  });

  it('offers platform history only to gig income', () => {
    const gig: Partial<Answers> = { incomeType: 'gig' };
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(gig)).map((q) => q.id)).toContain('platformHistoryMonths');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(priya)).map((q) => q.id)).not.toContain('platformHistoryMonths');
  });

  it('only offers "was it within 3 months" once a 12-month bounce is confirmed', () => {
    const noBounce: Partial<Answers> = { bounceInLast12Months: false };
    const withBounce: Partial<Answers> = { bounceInLast12Months: true };
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(noBounce)).map((q) => q.id)).not.toContain('bounceInLast3Months');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(withBounce)).map((q) => q.id)).toContain('bounceInLast3Months');
  });

  it('only asks the existing-debt rate when an existing EMI was actually stated as nonzero', () => {
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen({ existingEmiMonthly: 0 })).map((q) => q.id)).not.toContain(
      'existingDebtAPR',
    );
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen({ existingEmiMonthly: 5_000 })).map((q) => q.id)).toContain(
      'existingDebtAPR',
    );
  });

  it('reveals collateral value only after collateral type is given, and livelihood only after a value is given', () => {
    const none: Partial<Answers> = {};
    const typed: Partial<Answers> = { collateralType: 'property' };
    const valued: Partial<Answers> = { collateralType: 'property', collateralValue: 1_000_000 };
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(none)).map((q) => q.id)).not.toContain('collateralValue');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(typed)).map((q) => q.id)).toContain('collateralValue');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(typed)).map((q) => q.id)).not.toContain('collateralIsLivelihoodOrOnlyHome');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(valued)).map((q) => q.id)).toContain('collateralIsLivelihoodOrOnlyHome');
  });

  it('offers productive uplift and EV status only for business/vehicle purposes', () => {
    const wedding: Partial<Answers> = { purpose: 'wedding' };
    const vehicle: Partial<Answers> = { purpose: 'vehicle' };
    const business: Partial<Answers> = { purpose: 'business' };
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(wedding)).map((q) => q.id)).not.toContain('expectedMonthlyUplift');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(vehicle)).map((q) => q.id)).toContain('expectedMonthlyUplift');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(business)).map((q) => q.id)).toContain('expectedMonthlyUplift');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(vehicle)).map((q) => q.id)).toContain('isElectricVehicle');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(wedding)).map((q) => q.id)).not.toContain('isElectricVehicle');
  });

  it('only offers card utilisation below a 650 score when unknown or good', () => {
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen({ creditScore: 600 })).map((q) => q.id)).not.toContain(
      'cardUtilisation',
    );
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen({ creditScore: 700 })).map((q) => q.id)).toContain('cardUtilisation');
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen({ creditScore: undefined })).map((q) => q.id)).toContain(
      'cardUtilisation',
    );
  });
});

describe('unknown handling', () => {
  it('offers nothing until the hard-required baseline exists', () => {
    expect(applicableOptionalQuestions({})).toEqual([]);
    expect(applicableOptionalQuestions({ purpose: 'wedding', askAmount: 100_000 })).toEqual([]);
  });

  it('does not treat "unanswered" as false for a boolean field\'s adaptivity', () => {
    // bounceInLast12Months undefined must NOT satisfy the ===true gate for the follow-up
    const undecided: Partial<Answers> = { bounceInLast12Months: undefined };
    expect(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(undecided)).map((q) => q.id)).not.toContain(
      'bounceInLast3Months',
    );
  });
});

describe('relevant optional questions only — impact is measured, not assumed', () => {
  it('excludes a question that provably moves nothing for this borrower (Anita: rate already clamped at ceiling)', () => {
    const ranked = applicableOptionalQuestions(anita);
    expect(ranked.map((r) => r.question.id)).not.toContain('cardUtilisation');
  });

  it('includes a question that genuinely moves an output for this borrower', () => {
    const ranked = applicableOptionalQuestions(anita);
    expect(ranked.map((r) => r.question.id)).toContain('cashMonthlyIncomeBad');
    expect(ranked.map((r) => r.question.id)).toContain('coApplicantIncome');
  });

  it('ranks questions by impact magnitude, largest first', () => {
    const ranked = applicableOptionalQuestions(anita);
    const magnitudes = ranked.map((r) => Math.max(0, ...r.impact.affects.map((a) => a.magnitude)));
    for (let i = 1; i < magnitudes.length; i += 1) {
      expect(magnitudes[i]).toBeLessThanOrEqual(magnitudes[i - 1]);
    }
  });

  it('questionImpact reports which outputs a genuinely relevant question moves', () => {
    const q = OPTIONAL_QUESTIONS.find((x) => x.id === 'emergencySavingsMonths')!;
    const impact = questionImpact(q, priya);
    expect(impact.hasImpact).toBe(true);
    expect(impact.affects.map((a) => a.output)).toEqual(expect.arrayContaining(['safeMax', 'emiCeiling']));
  });
});

describe('all three personas\' question paths', () => {
  it('Priya (salaried) is never offered self-employment or gig-specific questions', () => {
    const applicable = OPTIONAL_QUESTIONS.filter((q) => q.id !== 'yearsAtCurrentEmployer' && q.appliesWhen(priya));
    const selfEmployedOnly = ['itrAnnualIncome', 'businessVintageYears', 'gstAndCurrentAccount', 'platformHistoryMonths', 'cashMonthlyIncomeBad'];
    for (const id of selfEmployedOnly) {
      expect(applicable.map((q) => q.id)).not.toContain(id);
    }
  });

  it('Ravi (self-employed, unencumbered property) sees self-employment and collateral questions, not employer tenure', () => {
    const applicable = OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(ravi));
    const ids = applicable.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['collateralIsLivelihoodOrOnlyHome', 'expectedMonthlyUplift']));
    expect(ids).not.toContain('yearsAtCurrentEmployer');
    expect(ids).not.toContain('platformHistoryMonths');
    // he already answered itrAnnualIncome/businessVintageYears/gstAndCurrentAccount/cashMonthlyIncomeBad,
    // so they correctly don't appear in what's still APPLICABLE-AND-UNANSWERED
    const stillUnanswered = applicableOptionalQuestions(ravi).map((r) => r.question.id);
    expect(stillUnanswered).not.toContain('itrAnnualIncome');
  });

  it('Anita (informal, vehicle purpose) sees EV and productive-uplift questions, not self-employed/salaried ones', () => {
    const applicable = OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(anita));
    const ids = applicable.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['cashMonthlyIncomeBad', 'expectedMonthlyUplift']));
    expect(ids).not.toContain('yearsAtCurrentEmployer');
    expect(ids).not.toContain('itrAnnualIncome');
    expect(ids).not.toContain('platformHistoryMonths');
  });

  it('the three personas end up with genuinely different applicable optional question sets', () => {
    const priyaIds = new Set(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(priya)).map((q) => q.id));
    const raviIds = new Set(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(ravi)).map((q) => q.id));
    const anitaIds = new Set(OPTIONAL_QUESTIONS.filter((q) => q.appliesWhen(anita)).map((q) => q.id));
    expect(priyaIds).not.toEqual(raviIds);
    expect(raviIds).not.toEqual(anitaIds);
    expect(priyaIds).not.toEqual(anitaIds);
  });
});
