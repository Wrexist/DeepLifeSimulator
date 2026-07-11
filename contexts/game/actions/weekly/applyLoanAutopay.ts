/**
 * Per-loan weekly autopay — R7 Phase 2 step 2.4e.
 *
 * Scope: iterate every loan in `prevLoans`, accrue weekly APR interest,
 * decide autopay vs missed-payment penalty, and produce the updated loan
 * array plus running totals. Previously inline in
 * `GameActionsContext.tsx:913-966` (~52 lines).
 *
 * Per-loan algorithm (preserved 1:1 from the legacy code):
 *   1. Sanitize `remaining` (NaN/Infinity/negative → 0); skip if <= 0.
 *   2. Sanitize APR: values > 1 are percentages (divide by 100); else used
 *      as decimal. Compute weeklyRate = aprDecimal / WEEKS_PER_YEAR.
 *   3. `remainingWithInterest = remaining * (1 + weeklyRate)`.
 *   4. Compute paymentDue:
 *        - If configured `weeklyPayment` > 0, use it (capped at
 *          `remainingWithInterest`).
 *        - Else fallback to `remainingWithInterest / weeksRemaining`
 *          (with a 0.1% floor) — or `remainingWithInterest` itself when
 *          weeksRemaining is 0.
 *   5. Decide autopay:
 *        - `canAffordPayment`: paymentDue > 0 AND cash >= paymentDue AND
 *          cash - paymentDue >= BANKRUPTCY_FLOOR (soft-lock protection).
 *        - `forcePayment`: paymentDue > 0 AND cash >= paymentDue * 2 —
 *          breathing-room override that ignores the bankruptcy floor.
 *      If either: pay it, deduct from cash, return updated loan.
 *   6. Else: apply LOAN_MISSED_PAYMENT_PENALTY (compounded into remaining),
 *      track the delta as `totalLoanPenalty`, return penalized loan.
 *
 * Finally: filter out loans whose `remaining <= 0` (paid off).
 *
 * Pure function. No React, no ctx, no notifications, no logging. The
 * caller threads `cashAfter` back into its money writeback and uses the
 * totals in the day-summary log line.
 */

import type { Loan } from '@/contexts/game/types';
import { LOAN_MISSED_PAYMENT_PENALTY } from '@/lib/economy/constants';
import { WEEKS_PER_YEAR, BANKRUPTCY_FLOOR } from '@/lib/config/gameConstants';

export interface LoanAutopayInput {
  /** Loans BEFORE the tick. May be undefined / empty / contain invalid entries. */
  prevLoans: Loan[] | undefined | null;
  /** Player cash AT THE ENTRY POINT of loan processing. */
  cashAvailable: number;
}

export interface LoanAutopayResult {
  /**
   * Loans AFTER the tick. Loans paid off this week (remaining ≤ 0)
   * are filtered out — `processedLoans.length` ≤ `prevLoans.length`.
   */
  processedLoans: Loan[];
  /** Total cash deducted across all loan autopays this tick. */
  totalLoanAutoPaid: number;
  /** Total interest added to outstanding loans via missed-payment penalty. */
  totalLoanPenalty: number;
  /**
   * Total weekly APR interest actually SERVICED on paid loans this tick — the
   * interest that compounded onto a loan the player paid down. Feeds
   * `banking.totalInterestPaid` so it stops reading $0. Missed-payment weeks
   * contribute $0 here (that interest is tracked as penalty, not serviced).
   */
  totalLoanInterest: number;
  /** Cash AFTER autopay deductions. = cashAvailable - totalLoanAutoPaid. */
  cashAfter: number;
}

export function applyLoanAutopay(input: LoanAutopayInput): LoanAutopayResult {
  let cashAfter = input.cashAvailable;
  let totalLoanAutoPaid = 0;
  let totalLoanPenalty = 0;
  let totalLoanInterest = 0;

  const processedLoans: (Loan | null)[] = (input.prevLoans || []).map((loan) => {
    const remaining = typeof loan.remaining === 'number' && isFinite(loan.remaining)
      ? Math.max(0, loan.remaining)
      : 0;
    if (remaining <= 0) return null;

    // Prefer interestRate (preserves existing behavior, incl. legit 0% loans);
    // fall back to the canonical rateAPR only when interestRate is missing/NaN
    // so a loan created with only rateAPR set doesn't silently autopay at 0%.
    const aprRaw = typeof loan.interestRate === 'number' && isFinite(loan.interestRate)
      ? loan.interestRate
      : (typeof loan.rateAPR === 'number' && isFinite(loan.rateAPR) ? loan.rateAPR : 0);
    const aprDecimal = aprRaw > 1 ? aprRaw / 100 : Math.max(0, aprRaw);
    const weeklyRate = aprDecimal / WEEKS_PER_YEAR;
    const remainingWithInterest = Math.max(0, remaining * (1 + weeklyRate));

    const weeksRemaining = typeof loan.weeksRemaining === 'number' && isFinite(loan.weeksRemaining)
      ? Math.max(0, Math.floor(loan.weeksRemaining))
      : 0;
    const fallbackPayment = weeksRemaining > 0
      ? Math.max(remainingWithInterest / weeksRemaining, remainingWithInterest * 0.001)
      : remainingWithInterest;
    const configuredPayment = typeof loan.weeklyPayment === 'number' && isFinite(loan.weeklyPayment) && loan.weeklyPayment > 0
      ? loan.weeklyPayment
      : fallbackPayment;
    const paymentDue = Math.min(remainingWithInterest, Math.max(0, configuredPayment));

    // ANTI-EXPLOIT: Bankruptcy protection — don't auto-pay if it would drain cash
    // below the floor. Prevents soft-lock where player can't afford job applications.
    const canAffordPayment = paymentDue > 0 && cashAfter >= paymentDue
      && (cashAfter - paymentDue) >= BANKRUPTCY_FLOOR;
    // Allow payment even below floor if cash exceeds payment by 2× (breathing room).
    const forcePayment = paymentDue > 0 && cashAfter >= paymentDue * 2;
    if (canAffordPayment || forcePayment) {
      cashAfter -= paymentDue;
      totalLoanAutoPaid += paymentDue;
      // Interest serviced this week = the APR interest that compounded onto the
      // balance before this payment (remainingWithInterest - remaining).
      totalLoanInterest += (remainingWithInterest - remaining);
      return {
        ...loan,
        remaining: Math.max(0, remainingWithInterest - paymentDue),
        weeksRemaining: Math.max(0, weeksRemaining - 1),
      };
    }

    // Missed payment — apply compounding penalty, but BOUND it. Without a cap,
    // a player stuck just above the bankruptcy floor (so payments are skipped to
    // protect the floor) sees the balance compound every week forever and never
    // triggers bankruptcy — an unresolvable runaway-debt soft-lock (and eventual
    // float blow-up). Cap the compounded total at 3× the original principal (or
    // the current balance, if already higher) so it can't run away.
    const penaltyCap = typeof loan.principal === 'number' && isFinite(loan.principal) && loan.principal > 0
      ? Math.max(remainingWithInterest, loan.principal * 3)
      : remainingWithInterest;
    const penalizedRemaining = Math.min(
      penaltyCap,
      Math.max(0, remainingWithInterest * (1 + LOAN_MISSED_PAYMENT_PENALTY)),
    );
    totalLoanPenalty += (penalizedRemaining - remainingWithInterest);
    return {
      ...loan,
      remaining: penalizedRemaining,
      weeksRemaining: Math.max(0, weeksRemaining - 1),
    };
  });

  // Filter out paid-off loans (remaining ≤ 0).
  const survivors = processedLoans.filter(
    (loan): loan is Loan => Boolean(loan && loan.remaining > 0),
  );

  return {
    processedLoans: survivors,
    totalLoanAutoPaid,
    totalLoanPenalty,
    totalLoanInterest,
    cashAfter,
  };
}
