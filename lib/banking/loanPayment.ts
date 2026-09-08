import type { Loan } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/**
 * The next scheduled obligation before affordability/missed-payment handling.
 * Shared by the weekly collector and projections. This is the amount owed,
 * even when the collector must preserve the player's bankruptcy cash floor.
 * APR compatibility, fallback payments and payoff capping match legacy saves.
 */
export function getWeeklyLoanPayment(loan: Partial<Loan> | null | undefined) {
  const remaining = typeof loan?.remaining === 'number' && isFinite(loan?.remaining)
    ? Math.max(0, loan?.remaining)
    : 0;
  if (remaining <= 0) return { remaining: 0, remainingWithInterest: 0, aprDecimal: 0, weeksRemaining: 0, paymentDue: 0 };

  // Prefer interestRate (preserves existing behavior, incl. legit 0% loans);
  // fall back to the canonical rateAPR only when interestRate is missing/NaN
  // so a loan created with only rateAPR set doesn't silently autopay at 0%.
  const aprRaw = typeof loan?.interestRate === 'number' && isFinite(loan?.interestRate)
    ? loan?.interestRate
    : (typeof loan?.rateAPR === 'number' && isFinite(loan?.rateAPR) ? loan?.rateAPR : 0);
  const aprDecimal = aprRaw > 1 ? aprRaw / 100 : Math.max(0, aprRaw);
  const weeklyRate = aprDecimal / WEEKS_PER_YEAR;
  const remainingWithInterest = Math.max(0, remaining * (1 + weeklyRate));

  const weeksRemaining = typeof loan?.weeksRemaining === 'number' && isFinite(loan?.weeksRemaining)
    ? Math.max(0, Math.floor(loan?.weeksRemaining))
    : 0;
  const fallbackPayment = weeksRemaining > 0
    ? Math.max(remainingWithInterest / weeksRemaining, remainingWithInterest * 0.001)
    : remainingWithInterest;
  const configuredPayment = typeof loan?.weeklyPayment === 'number' && isFinite(loan?.weeklyPayment) && loan?.weeklyPayment > 0
    ? loan?.weeklyPayment
    : fallbackPayment;
  const paymentDue = Math.min(remainingWithInterest, Math.max(0, configuredPayment));
  return { remaining, remainingWithInterest, aprDecimal, weeksRemaining, paymentDue };
}
