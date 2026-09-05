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
