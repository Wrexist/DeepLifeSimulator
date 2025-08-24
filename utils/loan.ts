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
  const termWeeks = 52;
  const weeklyRate = apr / 100 / termWeeks;

  const reasons: string[] = [];
  const existingPayments = existingLoans.reduce(
    (sum, l) => sum + Math.max(0, l.weeklyPayment),
    0
  );

  const canOpenAnotherLoan = existingLoans.length < 2;
  if (!canOpenAnotherLoan) {
    reasons.push('Too many active loans');
  }

  // Adjusted net worth and base cap
  const adjustedNetWorth = netWorth * 0.7;
  let cap = adjustedNetWorth * 0.1; // 10% of adjusted net worth

  // Education bonus
  cap *= 1 + 0.1 * Math.max(0, educationTiers);
  // Credit multiplier up to +25%
  cap *= 1 + 0.25 * Math.max(0, Math.min(1, credit));

  // DTI constraint
  const maxWeeklyPaymentFromDTI = weeklyIncome * 0.25 - existingPayments;
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

  if (!canOpenAnotherLoan) {
    maxNewLoanAmount = 0;
  }

  if (maxNewLoanAmount < 500) {
    if (maxNewLoanAmount > 0) {
      reasons.push('Below minimum loan size');
    }
    maxNewLoanAmount = 0;
  }

  const weeklyPaymentAtMax = maxNewLoanAmount > 0
    ? (maxNewLoanAmount * weeklyRate) /
      (1 - Math.pow(1 + weeklyRate, -termWeeks))
    : 0;

  return {
    maxNewLoanAmount,
    weeklyPaymentAtMax,
    apr,
    termWeeks,
    canOpenAnotherLoan,
    reasons,
  };
}
