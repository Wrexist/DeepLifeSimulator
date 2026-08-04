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

import { BankingState, BudgetCategory, Loan } from '@/contexts/game/types';
import { accrueCreditCardInterest, accrueAccountInterest, detectBudgetOverspend, MIRRORED_ACCOUNT_IDS, recomputeCreditScore, tickBillPay, trackBudgetSpend } from './operations';
import { getRateEnvironment } from './rateEnvironment';

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
  /**
   * Standing arrears (v31 `overdueBalance`) — mandatory weekly bills the player
   * could not cover. Feeds the credit-score recompute as late-payment
   * equivalents, so falling behind on rent and tax reads on the credit report
   * the same way missing a loan payment does. Optional; defaults to no drag.
   */
  overdueBalance?: number;
  /**
   * Categorized cash outflows already deducted by the legacy weekly pipeline
   * (rent, upkeep, diet, taxes, pet food, vehicle running costs, loan autopay…).
   * Recorded into banking.budgetSpend so the Budget tab reflects real spending.
   * Zero / negative / non-finite amounts are ignored (trackBudgetSpend guards).
   * NOTE: do NOT pass outflows that are already tracked elsewhere (bill-pay
   * rules and manual loan payments call trackBudgetSpend themselves).
   */
  spendEvents?: { category: BudgetCategory; amount: number }[];
  /**
   * Legacy savings interest already credited into `newBankSavings` this week by
   * the legacy pipeline (applySavingsInterest). Added to `totalInterestEarned`
   * alongside the freshly accrued self-opened-account interest so the "Earned"
   * chip and crossSystemSummary stop reading $0. Optional / defaults to 0.
   */
  savingsInterest?: number;
  /**
   * Interest actually SERVICED on loans this week via the real autopay path
   * (`applyLoanAutopay(...).totalLoanInterest`). Added to `totalInterestPaid`
   * so the "Paid" chip reflects real debt-service. Optional / defaults to 0.
   */
  loanInterestPaid?: number;
}

export interface WeeklyBankingTickResult {
  banking: BankingState;
  /** Loans with updated on-time / late counters — caller should write these to gameState.loans. */
  loansWithTrackers: Loan[];
  /** Pretty notifications for rate-shock / late-fee events the UI can surface. */
  notifications: { id: string; title: string; message: string }[];
  /** Total late fees deducted this tick. Caller subtracts from cash. */
  lateFeesDeducted: number;
  /**
   * Total of bills paid this tick FROM a mirrored (checking-default) account.
   * Those debits hit a balance that is overwritten from stats.money every tick,
   * so they must be charged against real cash by the caller — otherwise a "paid"
   * bill costs the player nothing. Bills paid from a real self-opened account are
   * excluded (already debited in `banking`).
   */
  billsPaidFromCash: number;
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
  // Guard against a partially-migrated save where `banking` exists but
  // `accounts` doesn't — an unguarded .map() here throws inside the weekly-tick
  // updater and silently bricks "Next Week".
  const accounts = (banking.accounts || []).map((acct) => {
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

  // 1a-rate. Resolve the live rate environment from the current economy state so
  // the long-cosmetic "rates rising/falling" notifications finally have teeth.
  // depositMult scales deposit APY (clamped to the hard cap in accrueAccountInterest);
  // loanDelta is persisted on banking.rateEnvironment for new-loan quotes to read.
  const rateEnv = getRateEnvironment(input.economyState);
  banking = { ...banking, rateEnvironment: rateEnv };

  // 1b. Accrue APR on self-opened accounts (savings/HY/CD/money market).
  // The advertised baseAPR previously never paid out — the legacy interest
  // path only covered the mirrored savings-default account. The live rate
  // environment's depositMult now scales the yield (recession/crash lower it,
  // boom raises it — always under SAVINGS_APR_HARD_CAP).
  const accrual = accrueAccountInterest(banking, rateEnv.depositMult);
  banking = accrual.banking;

  // 1c. Write the interest ledgers that were permanently $0 (audit #7).
  //   - totalInterestEarned += freshly accrued account interest + the legacy
  //     savings interest already folded into newBankSavings this week.
  //   - totalInterestPaid  += the interest serviced on the real loan-autopay
  //     path, threaded in from applyLoanAutopay(...).totalLoanInterest.
  // 1b-cards. R3-M8: revolving card balances finally accrue their advertised
  // APR. This was inert, so a maxed card at 17% cost the player nothing.
  const cardAccrual = accrueCreditCardInterest(banking);
  banking = cardAccrual.banking;
  if (cardAccrual.totalInterest > 0) {
    notifications.push({
      id: `card-interest-${input.currentWeek}`,
      title: '💳 Card Interest Charged',
      message: `Your credit card balance grew by $${Math.round(cardAccrual.totalInterest).toLocaleString()} in interest.`,
    });
  }

  const interestEarnedThisWeek = safe(accrual.totalInterest) + safe(input.savingsInterest);
  const interestPaidThisWeek = safe(input.loanInterestPaid) + safe(cardAccrual.totalInterest);
  if (interestEarnedThisWeek > 0 || interestPaidThisWeek > 0) {
    banking = {
      ...banking,
      totalInterestEarned: safe(banking.totalInterestEarned) + Math.max(0, interestEarnedThisWeek),
      totalInterestPaid: safe(banking.totalInterestPaid) + Math.max(0, interestPaidThisWeek),
    };
  }

  // 2. Run user-added bill-pay rules (Phase C adds the UI; for now this is a no-op for
  //    existing players because billPayRules[] is empty).
  const billResult = tickBillPay(banking, input.currentWeek);
  banking = billResult.banking;
  // Bills paid from a mirrored account only debited that mirror's balance (wiped
  // next tick from stats.money), so they must be charged against real cash by the
  // caller. Bills from a real self-opened account are already debited in `banking`.
  const billsPaidFromCash = billResult.paid.reduce(
    (sum, p) => (MIRRORED_ACCOUNT_IDS.has(p.rule.fromAccountId) ? sum + p.amount : sum),
    0
  );
  let lateFeesDeducted = 0;
  if (billResult.missed.length > 0) {
    lateFeesDeducted = billResult.missed.reduce((sum) => sum + 35, 0);
    notifications.push({
      id: 'billpay-missed',
      title: '💳 Missed Bill Payments',
      message: `${billResult.missed.length} bill${billResult.missed.length > 1 ? 's' : ''} could not be paid. Late fees applied.`,
    });
  }

  // 2b. Record the weekly pipeline's categorized cash outflows into the budget
  //     tracker. These were already deducted from cash by the legacy tick —
  //     this only makes them visible on the Budget tab (no balance changes).
  for (const ev of input.spendEvents ?? []) {
    banking = trackBudgetSpend(banking, input.currentWeek, ev.category, ev.amount);
  }

  // 2c. Budget targets (computer-only) — flag any category whose week's spend
  //     exceeded its configured cap with a single overspend notification. Pure
  //     read; no money moves. Fires at most once per week (one tick / week).
  const overspends = detectBudgetOverspend(banking, input.currentWeek);
  if (overspends.length > 0) {
    const names = overspends.map((o) => o.category).join(', ');
    notifications.push({
      id: `budget-overspend-${input.currentWeek}`,
      title: '📊 Over Budget',
      message: `You went over your weekly budget in: ${names}.`,
    });
  }

  // 3. Sync loan payment trackers so credit score reflects the existing tick's outcome.
  const loansWithTrackers = syncLoanPaymentTrackers(
    input.prevLoans ?? [],
    input.processedLoans ?? [],
    input.currentWeek
  );

  // 4. Recompute credit score from the freshly synced loans + accounts + cards.
  banking = recomputeCreditScore(banking, loansWithTrackers, input.currentWeek, input.overdueBalance);

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

  return { banking, loansWithTrackers, notifications, lateFeesDeducted, billsPaidFromCash };
}
