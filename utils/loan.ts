import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface LoanEligibilityInput {
  netWorth: number;
  educationTiers: number;
  credit: number; // 0 to 1
  weeklyIncome: number;
  existingLoans: { weeklyPayment: number }[];
}

export interface LoanEligibilityResult {
  maxNewLoanAmount: number;
  weeklyPaymentAtMax: number;
  apr: number;
  termWeeks: number;
  canOpenAnotherLoan: boolean;
  reasons: string[];
}

export function loanEligibility({
  netWorth,
  educationTiers,
  credit,
  weeklyIncome,
  existingLoans,
}: LoanEligibilityInput): LoanEligibilityResult {
  const apr = 18; // percent
  const termWeeks = WEEKS_PER_YEAR;
  const weeklyRate = apr / 100 / termWeeks;

  // BUGFIX: NaN inputs propagated through Math.min and `NaN < 500` is false,
  // so the early-zero guard silently passed NaN through to the UI.
  const safeNum = (n: unknown, fb = 0): number =>
    typeof n === 'number' && Number.isFinite(n) ? n : fb;
  const safeNetWorth = safeNum(netWorth);
  const safeEducationTiers = Math.max(0, safeNum(educationTiers));
  const safeCredit = Math.max(0, Math.min(1, safeNum(credit)));
  const safeWeeklyIncome = Math.max(0, safeNum(weeklyIncome));
  const safeExistingLoans = Array.isArray(existingLoans) ? existingLoans : [];

  const reasons: string[] = [];
  const existingPayments = safeExistingLoans.reduce(
    (sum, l) => sum + Math.max(0, safeNum(l?.weeklyPayment)),
    0
  );

  const canOpenAnotherLoan = safeExistingLoans.length < 2;
  if (!canOpenAnotherLoan) {
    reasons.push('Too many active loans');
  }

  // Adjusted net worth and base cap
  const adjustedNetWorth = safeNetWorth * 0.7;
  let cap = adjustedNetWorth * 0.1; // 10% of adjusted net worth

  // Education bonus
  cap *= 1 + 0.1 * safeEducationTiers;
  // Credit multiplier up to +25%
  cap *= 1 + 0.25 * safeCredit;

  // DTI constraint
  const maxWeeklyPaymentFromDTI = safeWeeklyIncome * 0.25 - existingPayments;
  if (maxWeeklyPaymentFromDTI <= 0) {
    reasons.push('Debt-to-income limit reached');
  }
  const paymentFactor = weeklyRate
    ? (1 - Math.pow(1 + weeklyRate, -termWeeks)) / weeklyRate
    : termWeeks;
  const maxLoanFromDTI = maxWeeklyPaymentFromDTI > 0
    ? maxWeeklyPaymentFromDTI * paymentFactor
    : 0;

  let maxNewLoanAmount = Math.min(cap, maxLoanFromDTI);

  // Final NaN/Infinity guard — Math.min(NaN, x) is NaN, and `NaN < 500` is false.
  if (!Number.isFinite(maxNewLoanAmount)) maxNewLoanAmount = 0;

  if (!canOpenAnotherLoan) {
    maxNewLoanAmount = 0;
  }

  if (maxNewLoanAmount < 500) {
    if (maxNewLoanAmount > 0) {
      reasons.push('Below minimum loan size');
    }
    maxNewLoanAmount = 0;
  }

  const rawWeeklyPaymentAtMax = maxNewLoanAmount > 0
    ? (maxNewLoanAmount * weeklyRate) /
      (1 - Math.pow(1 + weeklyRate, -termWeeks))
    : 0;
  const weeklyPaymentAtMax = Number.isFinite(rawWeeklyPaymentAtMax) ? rawWeeklyPaymentAtMax : 0;

  return {
    maxNewLoanAmount,
    weeklyPaymentAtMax,
    apr,
    termWeeks,
    canOpenAnotherLoan,
    reasons,
  };
}
