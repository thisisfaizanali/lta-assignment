/**
 * Income assessment — RULES.md §3. Stance-independent: none of the fields
 * this module reads have an UNKNOWNS entry, so it runs once, not per-pass.
 *
 * Tracks the two numbers §3 insists must never merge: `assessedIncome` (what
 * a LENDER will credit — feeds lenderMax) and `trueIncome` (the borrower's
 * real bad-month earning — feeds safeMax). For a salaried borrower they're
 * identical; for everyone else they diverge, and that divergence is most of
 * why lenderMax and safeMax end up different.
 */
import {
  ASSESSED_INCOME_FACTOR,
  CO_APPLICANT_LENDER_WEIGHT,
  CO_APPLICANT_SAFETY_WEIGHT,
  GIG_MIN_HISTORY_MONTHS,
  PRODUCTIVE_UPLIFT_CAP_OF_INCOME,
  PRODUCTIVE_UPLIFT_HAIRCUT,
  SELF_EMPLOYED_CASH_ADDBACK,
  VOLATILE_INCOME_TYPES,
} from './constants';
import type { Answers, Explained } from './types';

/**
 * The bad-month rule (§3): for a volatile earner, "true" income is the
 * stated bad-month figure, not the average — falling back to the flat
 * netMonthlyIncome answer when the bad/good split was never given.
 */
function trueIncomeFor(answers: Answers): { value: number; why: string; from: string[] } {
  if (VOLATILE_INCOME_TYPES.includes(answers.incomeType) && answers.cashMonthlyIncomeBad !== undefined) {
    return {
      value: answers.cashMonthlyIncomeBad,
      why: 'We use your bad month, not your average — budgeting to the average means a bad month becomes a missed EMI.',
      from: ['cashMonthlyIncomeBad'],
    };
  }
  return {
    value: answers.netMonthlyIncome,
    why: VOLATILE_INCOME_TYPES.includes(answers.incomeType)
      ? "You didn't split out a bad vs. good month, so we use the figure you gave us as-is."
      : 'Your stated net monthly income.',
    from: ['netMonthlyIncome'],
  };
}

/**
 * What a LENDER will credit. Salaried is the stated figure at face value.
 * Self-employed: ITR/12, plus a partial add-back for banked-but-undeclared
 * cash — only where GST + a current account give a lender something to
 * verify against. Without an ITR figure at all, the only number we have is
 * the borrower's own stated netMonthlyIncome, used as-is (no add-back — an
 * add-back requires a declared baseline to measure a gap from).
 */
function assessedIncomeFor(answers: Answers): { value: number; why: string; from: string[] } {
  switch (answers.incomeType) {
    case 'salaried':
      return {
        value: answers.netMonthlyIncome * ASSESSED_INCOME_FACTOR.salaried,
        why: 'Salary is documented and stable — a lender credits it at face value.',
        from: ['netMonthlyIncome'],
      };

    case 'self_employed': {
      if (answers.itrAnnualIncome === undefined) {
        return {
          value: answers.netMonthlyIncome,
          why: "You didn't give us your ITR-declared income, so a lender has nothing but your stated figure to assess you against.",
          from: ['netMonthlyIncome'],
        };
      }
      const itrMonthly = answers.itrAnnualIncome / 12;
      const hasEvidence = answers.gstAndCurrentAccount === true;
      const cashBad = answers.cashMonthlyIncomeBad;
      const addBack =
        hasEvidence && cashBad !== undefined
          ? SELF_EMPLOYED_CASH_ADDBACK * Math.max(0, cashBad - itrMonthly)
          : 0;
      return {
        value: itrMonthly + addBack,
        why:
          addBack > 0
            ? `Lenders lend against your ITR (₹${Math.round(itrMonthly)}/month), plus a partial credit for the banked cash your GST registration and current account can back up.`
            : 'Lenders lend against your ITR-declared income, not what the shop actually takes in.',
        from: hasEvidence ? ['itrAnnualIncome', 'gstAndCurrentAccount', 'cashMonthlyIncomeBad'] : ['itrAnnualIncome'],
      };
    }

    case 'gig': {
      const hasHistory = (answers.platformHistoryMonths ?? 0) >= GIG_MIN_HISTORY_MONTHS;
      if (!hasHistory) {
        return {
          value: 0,
          why: `Without ${GIG_MIN_HISTORY_MONTHS}+ months of platform payout history, a lender has no track record to assess yet.`,
          from: ['platformHistoryMonths'],
        };
      }
      return {
        value: answers.netMonthlyIncome * ASSESSED_INCOME_FACTOR.gig,
        why: 'Platform earnings are real but unverifiable at a counter — a lender discounts them.',
        from: ['netMonthlyIncome', 'platformHistoryMonths'],
      };
    }

    case 'informal':
      return {
        value: answers.netMonthlyIncome * ASSESSED_INCOME_FACTOR.informal,
        why: 'Undocumented cash income — many formal lenders will assess this as zero; we credit half to stay usable without overstating it.',
        from: ['netMonthlyIncome'],
      };
  }
}

/**
 * §3's most arguable rule. Only ever informational and used in one verdict
 * gate's diagnostic (verdict.ts) — never folded into trueIncome or surplus,
 * since RULES.md §6.1's surplus formula has no uplift term.
 */
function productiveUpliftFor(answers: Answers, trueIncome: number): Explained<number> {
  const stated = answers.expectedMonthlyUplift ?? 0;
  const haircut = stated * PRODUCTIVE_UPLIFT_HAIRCUT;
  const cap = trueIncome * PRODUCTIVE_UPLIFT_CAP_OF_INCOME;
  const value = Math.min(haircut, cap);
  return {
    value,
    why:
      stated > 0
        ? `We count half of the ₹${Math.round(stated)}/month you expect this to earn, capped at 30% of your income, and only from the loan's fourth month — the first three still have to be affordable without it.`
        : 'No projected extra earning was stated for this loan.',
    from: ['expectedMonthlyUplift'],
  };
}

export interface IncomeAssessment {
  assessedIncome: Explained<number>;
  trueIncome: Explained<number>;
  productiveUplift: Explained<number>;
  coApplicant: Explained<{ lenderAddOn: number; safetyAddOn: number }>;
}

export function assessIncome(answers: Answers): IncomeAssessment {
  const assessed = assessedIncomeFor(answers);
  const trueInc = trueIncomeFor(answers);
  const uplift = productiveUpliftFor(answers, trueInc.value);

  const coApplicantIncome = answers.coApplicantIncome ?? 0;
  const coApplicant: Explained<{ lenderAddOn: number; safetyAddOn: number }> = {
    value: {
      lenderAddOn: coApplicantIncome * CO_APPLICANT_LENDER_WEIGHT,
      safetyAddOn: coApplicantIncome * CO_APPLICANT_SAFETY_WEIGHT,
    },
    why:
      coApplicantIncome > 0
        ? "A co-applicant's income raises what a lender will offer in full, but only half as much of your safe amount — your household still has one set of expenses."
        : 'No co-applicant income was stated.',
    from: ['coApplicantIncome'],
  };

  return {
    assessedIncome: { value: assessed.value, why: assessed.why, from: assessed.from },
    trueIncome: { value: trueInc.value, why: trueInc.why, from: trueInc.from },
    productiveUplift: uplift,
    coApplicant,
  };
}
