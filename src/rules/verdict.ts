/**
 * RULES.md §7 — ordered gates, first match wins, all evaluated on the
 * CAUTIOUS pass (VERDICT_STANCE). §7.0's rule governs every §7.1 gate here:
 * a gate may only read a field the borrower actually STATED (`answers.field
 * !== undefined`) — never a cautious placeholder filled in by UNKNOWNS. That
 * check is deliberately literal (`!== undefined`) rather than checking
 * whatever `resolveUnknown().stated` would say, since these gates need to
 * know "did the borrower answer this at all," not "did this particular pass
 * have to fill it in."
 */
import {
  CONSUMPTION_PURPOSES,
  COSTLY_DEBT_THRESHOLD_APR,
  NO_BUFFER_CONSUMPTION_ASK_MULTIPLE,
  OVERCOMMITTED_EXISTING_EMI_RATIO,
  PRODUCTS,
  PRUDENT_TENURE_MONTHS,
} from './constants';
import { emi } from './money';
import { defaultProductForPurpose, type RoutingResult } from './products';
import type { Answers, Explained, Verdict } from './types';
import type { IncomeAssessment } from './income';
import type { PersonalRate } from './rate';
import type { SafeMaxResult } from './affordability';

export interface VerdictContext {
  answers: Answers;
  routing: RoutingResult;
  income: IncomeAssessment;
  cautiousRate: PersonalRate;
  safeMaxCautious: SafeMaxResult;
}

/** Surplus left over after servicing THIS ask, at the cautious band's midpoint, over the prudent tenure. */
function surplusAfterNewLoan(ctx: VerdictContext): number {
  const mid = (ctx.cautiousRate.band.lo + ctx.cautiousRate.band.hi) / 2;
  const newLoanEmi = emi({
    principal: ctx.answers.askAmount,
    annualRatePercent: mid,
    months: PRUDENT_TENURE_MONTHS[ctx.answers.purpose],
  });
  return ctx.safeMaxCautious.surplus - newLoanEmi;
}

export function computeVerdict(ctx: VerdictContext): Explained<Verdict> {
  const { answers, routing, income, safeMaxCautious } = ctx;

  // --- §7.1 Don't borrow ---

  // Deliberately product-independent: this checks whether the borrower's
  // EXISTING situation (income, rent, expenses, existing EMIs) is already
  // underwater, before any new loan is even considered. It must NOT depend on
  // which product routing eventually recommends or that product's rate —
  // otherwise a borrower who genuinely can't afford the NAIVE/unsecured
  // product gets refused outright before the engine ever reaches §7.3's
  // "different product" explanation, which is exactly the case §7.3 exists
  // to handle (Ravi). Whether THIS SPECIFIC ask fits is §7.4's job, not this
  // gate's.
  const surplusInputsStated =
    answers.householdExpenses !== undefined && answers.existingEmiMonthly !== undefined;
  if (surplusInputsStated && safeMaxCautious.surplus < 0) {
    return {
      value: 'dont_borrow',
      why: 'At your stated income, rent, expenses and existing EMIs, your monthly surplus is already negative — before any new loan is even considered.',
      from: ['netMonthlyIncome', 'rent', 'householdExpenses', 'existingEmiMonthly'],
    };
  }

  if (
    answers.existingEmiMonthly !== undefined &&
    answers.existingEmiMonthly > OVERCOMMITTED_EXISTING_EMI_RATIO * income.trueIncome.value
  ) {
    return {
      value: 'dont_borrow',
      why: `Your existing EMIs already take more than ${OVERCOMMITTED_EXISTING_EMI_RATIO * 100}% of your income — more credit isn't the fix here.`,
      from: ['existingEmiMonthly', 'netMonthlyIncome'],
    };
  }

  const routedProductSecured = PRODUCTS[routing.product.value].secured;
  if (answers.bounceInLast3Months === true && !routedProductSecured) {
    return {
      value: 'dont_borrow',
      why: 'A bounce in the last three months plus a new unsecured application reads as a debt spiral to most lenders — clear the last three months of repayment history first.',
      from: ['bounceInLast3Months'],
    };
  }

  if (
    answers.emergencySavingsMonths === 0 &&
    CONSUMPTION_PURPOSES.includes(answers.purpose) &&
    answers.askAmount > NO_BUFFER_CONSUMPTION_ASK_MULTIPLE * answers.netMonthlyIncome
  ) {
    return {
      value: 'dont_borrow',
      why: `You told us you have no emergency savings, and this ask is more than ${NO_BUFFER_CONSUMPTION_ASK_MULTIPLE}x your monthly income for something that won't generate income back. Build a buffer, or scale the ask down, before taking this on.`,
      from: ['emergencySavingsMonths', 'purpose', 'askAmount', 'netMonthlyIncome'],
    };
  }

  // --- §7.2 Fix something first ---

  if (
    answers.existingDebtAPR !== undefined &&
    answers.existingDebtAPR > COSTLY_DEBT_THRESHOLD_APR &&
    ctx.cautiousRate.band.hi < answers.existingDebtAPR
  ) {
    return {
      value: 'fix_something_first',
      why: `You're carrying debt at ${answers.existingDebtAPR}% APR — even our most cautious estimate for this loan (${ctx.cautiousRate.band.hi.toFixed(1)}%) is cheaper. Clear or refinance that debt before taking on more; a new loan doesn't fix a balance sheet that's already losing to a costlier one.`,
      from: ['existingDebtAPR'],
    };
  }

  if (surplusInputsStated) {
    const withoutUplift = surplusAfterNewLoan(ctx);
    const withUplift = withoutUplift + income.productiveUplift.value;
    if (withoutUplift < 0 && withUplift >= 0 && income.productiveUplift.value > 0) {
      return {
        value: 'fix_something_first',
        why: "This loan would likely pay for itself, but your numbers don't work without counting income it hasn't earned yet. Start smaller, prove the extra earning for a few months, then revisit — don't size the loan to income you don't have yet.",
        from: ['expectedMonthlyUplift', 'netMonthlyIncome', 'rent', 'householdExpenses', 'existingEmiMonthly'],
      };
    }
  }

  // --- §7.3 Different product ---

  const naiveDefault = defaultProductForPurpose(answers.purpose);
  if (routing.mudraFlag || routing.product.value !== naiveDefault) {
    return {
      value: 'different_product',
      why: routing.product.why,
      from: routing.product.from,
    };
  }

  // --- §7.4 / §7.5 ---

  if (answers.askAmount > safeMaxCautious.safeMax.value) {
    return {
      value: 'borrow_less',
      why: 'You asked for more than you can safely carry. Take what\'s under "safe to carry," not the full ask.',
      from: ['askAmount'],
    };
  }

  return {
    value: 'borrow',
    why: 'Your ask is within what you can safely carry, and none of the caution gates fired.',
    from: ['askAmount'],
  };
}
