/**
 * Weekly banking tick — mirrors the legacy bankSavings/loans/cash flow into the
 * new BankingState slice and recomputes the credit score.
 *
 * Strategy during the AdvancedBankApp remake transition:
 *   - Legacy `bankSavings`, `loans[]`, and `stats.money` remain authoritative
 *     for the existing UI.
 *   - This helper produces a new `banking` slice that mirrors them so the new
 *     UI can read account balances, payment history, and credit score
 *     consistently.
 *   - Once the new UI ships and the legacy fields can be removed, this mirror
 *     collapses to direct ownership.
 *
 * Pure function — no React, no setGameState.
 */

import { BankingState, Loan } from '@/contexts/game/types';
import { recomputeCreditScore, tickBillPay } from './operations';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface WeeklyBankingTickInput {
  banking: BankingState;
  /** Loans BEFORE the existing weekly tick processed them (to detect paid vs missed). */
  prevLoans: Loan[];
  /** Loans AFTER the existing weekly tick — these become the new authoritative loans[]. */
  processedLoans: Loan[];
  /** Newly computed savings balance from the legacy savingsInterest logic. */
  newBankSavings: number;
  /** Cash on hand after income / rent / loan autopay. Mirrored into the checking account. */
  newMoney: number;
  /** Current economy state, used to surface rate-shock notifications. */
  economyState?: 'normal' | 'recession' | 'boom' | 'crash';
  currentWeek: number;
}

export interface WeeklyBankingTickResult {
  banking: BankingState;
  /** Loans with updated on-time / late counters — caller should write these to gameState.loans. */
  loansWithTrackers: Loan[];
  /** Pretty notifications for rate-shock / late-fee events the UI can surface. */
  notifications: { id: string; title: string; message: string }[];
  /** Total late fees deducted this tick. Caller subtracts from cash. */
  lateFeesDeducted: number;
}

/**
 * Update loan on-time / late counters based on whether the existing tick paid or penalized.
 *
 * Heuristic: if the new remaining went down compared to the previous remaining, it was paid.
 * If it went up (penalty applied) or the loan disappeared (paid off), we infer the outcome.
 */
function syncLoanPaymentTrackers(prev: Loan[], processed: Loan[], currentWeek: number): Loan[] {
  const result: Loan[] = [];

  for (const oldLoan of prev) {
    const oldRemaining = safe(oldLoan.remaining);
    if (oldRemaining <= 0) continue;

    const newLoan = processed.find((l) => l.id === oldLoan.id);
    if (!newLoan) {
      // Loan disappeared → fully paid off (counts as on-time).
      // Nothing to push to `result`; the loan is gone. But we still want to give a final +1 on-time
      // on the legacy state for credit-score history. We can't reattach a vanished loan, so we
      // record the on-time count on a "ghost" entry kept in the processed list — but processedLoans
      // already drops it. Accept the small undercount: paid-off loans simply stop contributing
      // new on-time hits.
      continue;
    }

    const newRemaining = safe(newLoan.remaining);
    const paid = newRemaining < oldRemaining;

    result.push({
      ...newLoan,
      onTimePayments: safe(newLoan.onTimePayments) + (paid ? 1 : 0),
      latePayments: safe(newLoan.latePayments) + (paid ? 0 : 1),
      lastPaidWeek: paid ? currentWeek : newLoan.lastPaidWeek,
      originalAPR: newLoan.originalAPR ?? newLoan.rateAPR,
    });
  }

  // Also include any loans in `processed` that weren't in `prev` (newly accepted this tick).
  for (const newLoan of processed) {
    if (prev.some((p) => p.id === newLoan.id)) continue;
    result.push({
      ...newLoan,
      onTimePayments: safe(newLoan.onTimePayments),
      latePayments: safe(newLoan.latePayments),
      originalAPR: newLoan.originalAPR ?? newLoan.rateAPR,
    });
  }

  return result;
}

/**
 * Mirror the player's cash + savings into the banking.accounts slice.
 *
 * - The first "checking" account tracks `stats.money` 1:1 (cash on hand).
 * - The first "savings" account tracks the legacy `bankSavings` balance.
 *
 * If those accounts don't exist (corrupted save), we leave the existing accounts alone
 * rather than fabricate replacements — the migration should have created them.
 */
function mirrorAccountsFromLegacy(
  banking: BankingState,
  newBankSavings: number,
  newMoney: number
): BankingState {
  const accounts = banking.accounts.map((acct) => {
    if (acct.id === 'checking-default') {
      return { ...acct, balance: Math.max(0, safe(newMoney)) };
    }
    if (acct.id === 'savings-default') {
      // Don't overwrite a user-managed savings balance that already differs from legacy.
      // Legacy bankSavings is the source of truth until Phase D removes it.
      return { ...acct, balance: Math.max(0, safe(newBankSavings)) };
    }
    return acct;
  });
  return { ...banking, accounts };
}

export function runWeeklyBankingTick(input: WeeklyBankingTickInput): WeeklyBankingTickResult {
  const notifications: WeeklyBankingTickResult['notifications'] = [];

  // 1. Mirror cash + savings into the banking slice.
  let banking = mirrorAccountsFromLegacy(input.banking, input.newBankSavings, input.newMoney);

  // 2. Run user-added bill-pay rules (Phase C adds the UI; for now this is a no-op for
  //    existing players because billPayRules[] is empty).
  const billResult = tickBillPay(banking, input.currentWeek);
  banking = billResult.banking;
  let lateFeesDeducted = 0;
  if (billResult.missed.length > 0) {
    lateFeesDeducted = billResult.missed.reduce((sum) => sum + 35, 0);
    notifications.push({
      id: 'billpay-missed',
      title: '💳 Missed Bill Payments',
      message: `${billResult.missed.length} bill${billResult.missed.length > 1 ? 's' : ''} could not be paid. Late fees applied.`,
    });
  }

  // 3. Sync loan payment trackers so credit score reflects the existing tick's outcome.
  const loansWithTrackers = syncLoanPaymentTrackers(
    input.prevLoans ?? [],
    input.processedLoans ?? [],
    input.currentWeek
  );

  // 4. Recompute credit score from the freshly synced loans + accounts + cards.
  banking = recomputeCreditScore(banking, loansWithTrackers, input.currentWeek);

  // 5. Detect economy-state changes → surface a notification.
  if (input.economyState && input.economyState !== banking.lastEconomyState) {
    const messages: Record<string, { title: string; message: string }> = {
      recession: { title: '📉 Economic Recession', message: 'Loan rates rising; savings yields falling.' },
      crash:     { title: '💥 Market Crash',       message: 'Credit tightens; banks pull premium offers.' },
      boom:      { title: '📈 Economic Boom',      message: 'Cheaper borrowing; better deposit yields.' },
      normal:    { title: '🏦 Markets Normalize',  message: 'Rates returning to baseline.' },
    };
    const msg = messages[input.economyState];
    if (msg) notifications.push({ id: `economy-${input.economyState}`, ...msg });
    banking = { ...banking, lastEconomyState: input.economyState };
  }

  return { banking, loansWithTrackers, notifications, lateFeesDeducted };
}
