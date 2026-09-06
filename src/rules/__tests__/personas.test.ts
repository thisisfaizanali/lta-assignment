/**
 * The three assignment personas, run through the real engine end to end.
 *
 * Several fields aren't given a number in the assignment brief and had to be
 * filled in to build a runnable Answers object. Each is commented at the
 * point it's set, and summarised again in the M3 report — these are testing
 * decisions, not engine behaviour, and none of them special-case the engine
 * itself (the engine has no persona-aware code path).
 */
import { describe, expect, it } from 'vitest';
import { BANNED_PHRASES } from '../constants';
import { runEngine } from '../engine';
import type { Answers, Explained, Outputs } from '../types';

const priya: Answers = {
  purpose: 'wedding',
  askAmount: 800_000,
  netMonthlyIncome: 110_000,
  incomeType: 'salaried',
  existingEmiMonthly: 14_000,
  rent: 28_000,
  householdExpenses: 24_000, // not given in the brief; a plausible Bengaluru single-earner figure
  age: 29,
  creditScore: 780,
  dependents: 0,
  yearsAtCurrentEmployer: 5,
  // emergencySavingsMonths, cardUtilisation, bounce history: genuinely not
  // mentioned in the brief — left undefined so the engine has to widen for them.
};

const ravi: Answers = {
  purpose: 'business',
  askAmount: 1_500_000,
  // The brief gives him two income figures (ITR, cash range) but no single
  // "net monthly income" — using the ITR-monthly figure as his most likely
  // answer to a generic must-question; itrAnnualIncome/cashMonthlyIncomeBad
  // below carry the actual precision.
  netMonthlyIncome: 35_000,
  incomeType: 'self_employed',
  existingEmiMonthly: 0, // "never taken a formal loan"
  rent: 0, // owns the shop premises; no separate rent mentioned
  householdExpenses: undefined, // not given
  age: 42,
  creditScore: 'never_borrowed',
  dependents: 1, // his wife; the brief doesn't mention children
  itrAnnualIncome: 420_000,
  businessVintageYears: 14,
  // Not stated in the brief — assumed true for a 14-year running shop so the
  // test exercises the "documented self-employed" path rather than
  // defaulting every self-employed persona to thin-docs by omission.
  gstAndCurrentAccount: true,
  cashMonthlyIncomeBad: 40_000,
  cashMonthlyIncomeGood: 80_000,
  // His wife's income is mentioned as context, not stated as a co-applicant
  // (nothing says she'd co-sign) — left out rather than assumed.
  collateralType: 'property',
  collateralValue: 4_500_000,
  collateralIsLivelihoodOrOnlyHome: true, // the shop premises IS his livelihood
};

const anita: Answers = {
  purpose: 'vehicle',
  askAmount: 150_000,
  // She earns ₹26,000-30,000 combined (gig + tailoring). IncomeType has no
  // "mixed" category; 'informal' is used as the more conservative of the two
  // components, since the tailoring income has no platform-verifiable trail
  // at all. This is a persona-modelling decision, not an engine special case.
  netMonthlyIncome: 26_000, // the low end, per the bad-month rule
  incomeType: 'informal',
  // The brief gives an outstanding app-loan balance (₹35,000), not a monthly
  // payment — ₹3,000/month is an estimated EMI on that balance at a
  // short-tenure, high-rate app-loan structure.
  existingEmiMonthly: 3_000,
  rent: 0, // not mentioned
  // Not stated in the brief. Left undefined here previously, which let the
  // cautious pass silently diverge from RUNTHROUGHS.md's published numbers
  // (real review finding). ₹20,000 is a plausible Hubballi figure for two
  // children plus a non-earning adult, and stating it keeps her stress test
  // meaningful — leaving it unstated makes the stress test pass, which
  // understates her actual exposure. Flagged as an assumption in
  // RUNTHROUGHS.md alongside her other stated estimates.
  householdExpenses: 20_000,
  age: 35,
  creditScore: undefined, // not given; NOT assumed bad merely because her situation is hard
  dependents: 3, // two children + a non-earning husband
  emergencySavingsMonths: 0, // inferred from 8 months of a single income plus three running app loans
  existingDebtAPR: 32, // "30%+"
  bounceInLast12Months: true,
  bounceInLast3Months: true, // "bounced last month"
  isElectricVehicle: true,
  // No rupee figure for the extra income "doubling delivery runs" would earn
  // is given anywhere in the brief — left unstated rather than invented, so
  // productiveUplift correctly comes out to zero. See the M3 report.
};

function allWhyStrings(outputs: Outputs): string[] {
  const explained: Explained<unknown>[] = [
    outputs.verdict,
    outputs.product,
    outputs.lenderMax,
    outputs.safeMax,
    outputs.rateBand,
    outputs.aprBand,
    outputs.emiCeiling,
    outputs.stress,
  ];
  return explained.map((e) => e.why);
}

describe('Priya — salaried, strong profile', () => {
  const outputs = runEngine(priya);

  it('produces a verdict other than dont_borrow', () => {
    expect(outputs.verdict.value).not.toBe('dont_borrow');
  });

  it('stays on the personal-loan product — no collateral, not self-employed', () => {
    expect(outputs.product.value).toBe('personal');
  });

  it('computes lenderMax and safeMax as genuinely different numbers', () => {
    expect(outputs.lenderMax.value.hi).not.toBe(outputs.safeMax.value.hi);
  });

  it('names the unanswered inputs it had to fill in, and only those', () => {
    expect(outputs.unresolvedInputs).toEqual(
      expect.arrayContaining(['emergencySavingsMonths', 'cardUtilisation', 'bounceInLast12Months']),
    );
    // she DID answer these — must not appear as unresolved
    expect(outputs.unresolvedInputs).not.toContain('creditScore');
    expect(outputs.unresolvedInputs).not.toContain('existingEmiMonthly');
    expect(outputs.unresolvedInputs).not.toContain('yearsAtCurrentEmployer');
  });
});

describe('Ravi — self-employed, thin file, unencumbered collateral', () => {
  const outputs = runEngine(ravi);

  it('does not silently route to LAP — Mudra is surfaced first', () => {
    expect(outputs.verdict.value).toBe('different_product');
    expect(outputs.product.why.toLowerCase()).toContain('mudra');
  });

  it('does not recommend pledging the shop merely because it increases borrowing capacity', () => {
    expect(outputs.product.value).not.toBe('lap');
  });

  it('assessed (lender) income and true income genuinely differ for a self-employed borrower', () => {
    // Internal check via a second run through income.ts would duplicate assessIncome's
    // own tests; here we assert the OUTWARD sign of that divergence: lenderMax
    // and safeMax are materially different numbers.
    expect(Math.abs(outputs.lenderMax.value.lo - outputs.safeMax.value.lo)).toBeGreaterThan(1);
  });

  // Review finding 3: he's a thin-file borrower on an unsecured product
  // (business, never_borrowed) — the rate band must say so, not price him as
  // if unsecured credit is freely available.
  it('warns that unsecured credit may not be available to him', () => {
    expect(outputs.rateBand.why.toLowerCase()).toContain('decline');
  });
});

describe('Anita — informal income, existing distress, productive purpose', () => {
  const outputs = runEngine(anita);

  it('does not let the productive purpose override her existing costly debt', () => {
    expect(outputs.verdict.value).toBe('fix_something_first');
  });

  it('the verdict explanation names refinancing the existing debt, not the scooter\'s upside', () => {
    expect(outputs.verdict.why.toLowerCase()).toMatch(/refinance|clear/);
  });

  it('is not treated as a straightforward vehicle-loan approval', () => {
    expect(outputs.verdict.value).not.toBe('borrow');
  });

  // Review finding 8 named Anita as the case where informal income's 0.5
  // assessed-income factor inverts lenderMax > safeMax. Re-checked against the
  // corrected fixture (Step 0's householdExpenses fix): it does NOT reproduce
  // here — her real household costs collapse safeMax so far that lenderMax
  // stays the (much) larger number. The inversion is still reachable for a
  // different informal borrower (see affordability.test.ts), just not hers.
  // Locked in as the actual, correct relationship rather than forcing the
  // review's original claim.
  it('does NOT show the informal-income inversion once her real household costs are counted — lenderMax stays the larger number', () => {
    expect(outputs.lenderMax.value.hi).toBeGreaterThan(outputs.safeMax.value.hi);
  });
});

describe('honesty — RULES.md §12', () => {
  it.each([priya, ravi, anita])('no output for this persona contains a banned phrase', (answers) => {
    const outputs = runEngine(answers);
    const text = allWhyStrings(outputs).join(' \n ').toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });

  it.each([priya, ravi, anita])('every output for this persona has a non-empty explanation', (answers) => {
    const outputs = runEngine(answers);
    for (const why of allWhyStrings(outputs)) {
      expect(why.length).toBeGreaterThan(0);
    }
  });
});

describe('cautious/favourable — the band never inverts', () => {
  it.each([priya, ravi, anita])('lo <= hi for every band output', (answers) => {
    const outputs = runEngine(answers);
    for (const band of [outputs.lenderMax.value, outputs.safeMax.value, outputs.rateBand.value, outputs.aprBand.value, outputs.emiCeiling.value]) {
      expect(band.lo).toBeLessThanOrEqual(band.hi);
    }
  });
});
