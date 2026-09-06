/**
 * How to render each question's answer control. Deliberately kept OUT of
 * questions.ts (M4): that module is UI-agnostic by design, and adding a
 * rendering hint there would blur "the rules layer knows nothing about
 * presentation." This is presentation metadata, nothing more — it carries no
 * threshold, no adjustment, no new field.
 */
import type { QuestionId } from '../rules/questions';

export type InputKind =
  | 'purpose'
  | 'incomeType'
  | 'creditScore'
  | 'collateralType'
  | 'money'
  | 'number'
  | 'percent'
  | 'boolean';

export const INPUT_KIND: Partial<Record<QuestionId, InputKind>> = {
  purpose: 'purpose',
  incomeType: 'incomeType',
  creditScore: 'creditScore',
  collateralType: 'collateralType',

  askAmount: 'money',
  netMonthlyIncome: 'money',
  rent: 'money',
  householdExpenses: 'money',
  existingEmiMonthly: 'money',
  itrAnnualIncome: 'money',
  cashMonthlyIncomeBad: 'money',
  cashMonthlyIncomeGood: 'money',
  existingDebtAPR: 'percent',
  collateralValue: 'money',
  coApplicantIncome: 'money',
  expectedMonthlyUplift: 'money',
  cardUtilisation: 'percent',

  age: 'number',
  dependents: 'number',
  emergencySavingsMonths: 'number',
  yearsAtCurrentEmployer: 'number',
  businessVintageYears: 'number',
  platformHistoryMonths: 'number',

  gstAndCurrentAccount: 'boolean',
  bounceInLast12Months: 'boolean',
  bounceInLast3Months: 'boolean',
  collateralIsLivelihoodOrOnlyHome: 'boolean',
  isElectricVehicle: 'boolean',
};

/**
 * Not every `percent` field is stored the same way, and conflating them silently
 * changes someone's rate.
 *
 * `cardUtilisation` is documented in types.ts as a 0..1 fraction and compared
 * against `CARD_UTILISATION_HIGH` (0.7), so a typed "20" must become 0.2.
 * `existingDebtAPR` is a whole-number annual rate compared against
 * `COSTLY_DEBT_THRESHOLD_APR` (24.0), so a typed "32" must stay 32.
 *
 * Divide by this on the way in, multiply by it when re-showing a stored answer.
 */
export function percentScaleFor(id: QuestionId): number {
  return id === 'cardUtilisation' ? 100 : 1;
}

export const PURPOSE_LABELS: Record<string, string> = {
  wedding: 'A wedding',
  business: 'Business stock or equipment',
  vehicle: 'A vehicle',
  medical: 'Medical treatment',
  home: 'Home purchase or repair',
  refinance: 'Paying off costlier debt',
  travel: 'Travel',
  consumption: 'Another personal expense',
};

export const INCOME_TYPE_LABELS: Record<string, string> = {
  salaried: 'Salaried',
  self_employed: 'Self-employed or business',
  gig: 'Gig or platform work',
  informal: 'Informal or cash income',
};
