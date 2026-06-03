/**
 * Loan amortization math.
 *
 * Pure functions. No game state, no React.
 * All rates are annual APR (decimal, e.g. 0.075 = 7.5%).
 * All periods are weeks. Conversions assume 52 weeks/year (see WEEKS_PER_YEAR).
 */

import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const safe = (n: number, fallback = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fallback;

/**
 * Standard amortizing payment per period.
 * Formula: P × r × (1 + r)^n / ((1 + r)^n − 1)
 *
 * Handles the zero-rate edge case (returns P / n).
 */
export function calculatePeriodicPayment(
  principal: number,
  annualAPR: number,
  termWeeks: number
): number {
  const P = safe(principal);
  const apr = Math.max(0, safe(annualAPR));
  const n = Math.max(1, Math.floor(safe(termWeeks, 1)));

  if (P <= 0) return 0;

  const r = apr / WEEKS_PER_YEAR;
  if (r === 0) return P / n;

  const factor = Math.pow(1 + r, n);
  const payment = (P * r * factor) / (factor - 1);
  return safe(payment, P / n);
}

/**
 * Total interest paid over the full term, assuming no prepayment.
 */
export function totalInterestOverTerm(
  principal: number,
  annualAPR: number,
  termWeeks: number
): number {
  const payment = calculatePeriodicPayment(principal, annualAPR, termWeeks);
  const total = payment * Math.max(1, Math.floor(safe(termWeeks, 1)));
  return Math.max(0, total - safe(principal));
}

/**
 * Split a single weekly payment into interest and principal components,
 * given the current outstanding balance.
 */
export function splitPayment(
  outstandingBalance: number,
  annualAPR: number,
  paymentAmount: number
): { interest: number; principal: number; newBalance: number } {
  const balance = Math.max(0, safe(outstandingBalance));
  const apr = Math.max(0, safe(annualAPR));
  const payment = Math.max(0, safe(paymentAmount));

  const r = apr / WEEKS_PER_YEAR;
  const interest = balance * r;
  const principal = Math.max(0, payment - interest);
  const newBalance = Math.max(0, balance - principal);

  return {
    interest: Math.max(0, interest),
    principal,
    newBalance,
  };
}

/**
 * Effective APR offered to a borrower with the given credit score, on top of a base APR.
 *
 * Idea: 750+ gets the base rate. 650 adds ~2%. 500 adds ~8%. Below 500 is rejected (caller decides).
 * Used by LoanActions when quoting a new loan and by BankingActions when issuing a credit card.
 */
export function creditScoreAPRAdjustment(creditScore: number): number {
  const s = Math.max(300, Math.min(850, safe(creditScore, 650)));
  if (s >= 800) return -0.005; // small premium discount
  if (s >= 740) return 0;
  if (s >= 700) return 0.01;
  if (s >= 670) return 0.02;
  if (s >= 620) return 0.035;
  if (s >= 580) return 0.05;
  return 0.08;
}

/**
 * Lowest accepted credit score by loan type. Below this, applications are rejected outright.
 */
export const MIN_SCORE_BY_LOAN_TYPE = {
  personal: 580,
  auto: 600,
  business: 650,
  mortgage: 620,
} as const;

/**
 * Debt-to-income gate. Returns true if the proposed new weekly payment would push the borrower
 * over the safe DTI threshold.
 *
 * Conservative DTI cap: 0.43 (matches U.S. qualified-mortgage rule).
 */
export function exceedsDTI(
  weeklyIncome: number,
  existingWeeklyDebtPayments: number,
  proposedWeeklyPayment: number,
  dtiCap = 0.43
): boolean {
  const income = Math.max(0, safe(weeklyIncome));
  if (income === 0) return true; // no income → any debt is over the line
  const totalDebt = Math.max(0, safe(existingWeeklyDebtPayments)) + Math.max(0, safe(proposedWeeklyPayment));
  return totalDebt / income > dtiCap;
}

/**
 * Annualize a weekly rate. Used to display "this CD pays 4.2% APY" given a weekly rate.
 */
export function annualizeWeeklyRate(weeklyRate: number): number {
  const r = safe(weeklyRate);
  if (r <= 0) return 0;
  return Math.pow(1 + r, WEEKS_PER_YEAR) - 1;
}
