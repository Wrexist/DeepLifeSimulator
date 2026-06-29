/**
 * Pure banking state transformations.
 *
 * Each function takes the current BankingState (and any extra inputs) and returns
 * a new BankingState. No React, no setGameState — that's the action layer's job.
 *
 * This lets us unit-test every banking mutation without rendering anything.
 */

import {
  BankAccount,
  BankAccountType,
  BankingState,
  BillPayRule,
  BudgetCategory,
  CreditCard,
  CreditCardTier,
  Loan,
  SavingsGoal,
} from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import {
  calculatePeriodicPayment,
  creditScoreAPRAdjustment,
  exceedsDTI,
  MIN_SCORE_BY_LOAN_TYPE,
  splitPayment,
} from './amortization';
import { computeCreditScore } from './creditScore';

const BUDGET_BUCKET_CAP = 12; // keep last 12 weeks of spend
const HISTORY_CAP = 100;
const INQUIRY_LOOKBACK_WEEKS = 2 * WEEKS_PER_YEAR;

/**
 * Accounts that are weekly 1:1 MIRRORS of the legacy fields, not independent
 * pools: `checking-default` mirrors `stats.money` and `savings-default` mirrors
 * `bankSavings` (see lib/banking/weeklyTick.ts → mirrorAccountsFromLegacy).
 * Manual cash moves on them desynced from the legacy source — the next mirror
 * tick overwrote the balance back, letting players print cash (withdraw/pay) or
 * destroy it (deposit). The action layer treats these as read-only mirrors and
 * routes any cash movement through the authoritative legacy field instead.
 */
export const MIRRORED_ACCOUNT_IDS: ReadonlySet<string> = new Set([
  'checking-default',
  'savings-default',
]);

const safe = (n: number | undefined, fb = 0): number => (typeof n === 'number' && isFinite(n) ? n : fb);

// ---------------------------------------------------------------------------
// Account lookup helpers
// ---------------------------------------------------------------------------

export function findAccount(banking: BankingState, accountId: string): BankAccount | undefined {
  return banking.accounts.find((a) => a.id === accountId);
}

export function findCheckingAccount(banking: BankingState): BankAccount | undefined {
  return banking.accounts.find((a) => a.type === 'checking');
}

export function totalBankBalance(banking: BankingState): number {
  return banking.accounts.reduce((sum, a) => sum + safe(a.balance), 0);
}

export function totalCreditCardDebt(banking: BankingState): number {
  return banking.creditCards.reduce((sum, c) => sum + safe(c.balance), 0);
}

export function totalCreditLimit(banking: BankingState): number {
  return banking.creditCards.reduce((sum, c) => sum + safe(c.creditLimit), 0);
}

// ---------------------------------------------------------------------------
// Account mutations
// ---------------------------------------------------------------------------

export function depositToAccount(
  banking: BankingState,
  accountId: string,
  amount: number
): { banking: BankingState; ok: boolean; reason?: string } {
  const amt = Math.max(0, safe(amount));
  if (amt === 0) return { banking, ok: false, reason: 'Amount must be positive' };

  const idx = banking.accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) return { banking, ok: false, reason: 'Account not found' };

  const next = { ...banking, accounts: [...banking.accounts] };
  next.accounts[idx] = { ...next.accounts[idx], balance: safe(next.accounts[idx].balance) + amt };
  return { banking: next, ok: true };
}

export function withdrawFromAccount(
  banking: BankingState,
  accountId: string,
  amount: number,
  currentWeek: number
): { banking: BankingState; ok: boolean; reason?: string } {
  const amt = Math.max(0, safe(amount));
  if (amt === 0) return { banking, ok: false, reason: 'Amount must be positive' };

  const idx = banking.accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) return { banking, ok: false, reason: 'Account not found' };

  const account = banking.accounts[idx];
  if (account.lockUntilWeek && currentWeek < account.lockUntilWeek) {
    return { banking, ok: false, reason: `Locked until week ${account.lockUntilWeek}` };
  }
  if (safe(account.balance) < amt) {
    return { banking, ok: false, reason: 'Insufficient funds' };
  }
  if (account.minBalance && safe(account.balance) - amt < account.minBalance) {
    return { banking, ok: false, reason: `Would breach minimum balance ($${account.minBalance})` };
  }

  const next = { ...banking, accounts: [...banking.accounts] };
  next.accounts[idx] = { ...account, balance: safe(account.balance) - amt };
  return { banking: next, ok: true };
}

export function transferBetweenAccounts(
  banking: BankingState,
  fromId: string,
  toId: string,
  amount: number,
  currentWeek: number
): { banking: BankingState; ok: boolean; reason?: string } {
  if (fromId === toId) return { banking, ok: false, reason: 'Cannot transfer to the same account' };
  // R6-C: defend against duplicate IDs in `banking.accounts` (legacy migration
  // bugs created `checking-default` twice). `findIndex` returns the first
  // match for `fromId`, so a `withdraw` succeeds on account[0], but a `deposit`
  // to a colliding `toId` could land on account[1] — leaving the first account
  // silently overdrawn.
  const fromMatches = banking.accounts.filter((a) => a.id === fromId).length;
  const toMatches = banking.accounts.filter((a) => a.id === toId).length;
  if (fromMatches > 1 || toMatches > 1) {
    return {
      banking,
      ok: false,
      reason: 'Account IDs collide — please reload your save or contact support.',
    };
  }
  const withdrawn = withdrawFromAccount(banking, fromId, amount, currentWeek);
  if (!withdrawn.ok) return withdrawn;
  return depositToAccount(withdrawn.banking, toId, amount);
}

export function openAccount(
  banking: BankingState,
  spec: {
    type: BankAccountType;
    name: string;
    initialDeposit: number;
    baseAPR: number;
    openedWeek: number;
    lockUntilWeek?: number;
    minBalance?: number;
  }
): { banking: BankingState; account: BankAccount } {
  const id = `${spec.type}-${spec.openedWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const account: BankAccount = {
    id,
    type: spec.type,
    name: spec.name,
    balance: Math.max(0, safe(spec.initialDeposit)),
    baseAPR: Math.max(0, safe(spec.baseAPR)),
    openedWeek: spec.openedWeek,
    lockUntilWeek: spec.lockUntilWeek,
    minBalance: spec.minBalance,
  };
  return { banking: { ...banking, accounts: [...banking.accounts, account] }, account };
}

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------

const CARD_TIER_DEFAULTS: Record<CreditCardTier, { creditLimit: number; rewardsRate: number; minCreditScore: number; annualFee: number }> = {
  starter:   { creditLimit: 500,    rewardsRate: 0.005, minCreditScore: 580, annualFee: 0 },
  standard:  { creditLimit: 3000,   rewardsRate: 0.01,  minCreditScore: 670, annualFee: 0 },
  gold:      { creditLimit: 10000,  rewardsRate: 0.02,  minCreditScore: 740, annualFee: 95 },
  platinum:  { creditLimit: 25000,  rewardsRate: 0.03,  minCreditScore: 800, annualFee: 495 },
};

export function applyForCreditCard(
  banking: BankingState,
  tier: CreditCardTier,
  baseAPR: number,
  openedWeek: number
): { banking: BankingState; ok: boolean; card?: CreditCard; reason?: string } {
  const defaults = CARD_TIER_DEFAULTS[tier];
  if (banking.creditScore.score < defaults.minCreditScore) {
    return { banking, ok: false, reason: `Need credit score ≥ ${defaults.minCreditScore}` };
  }
  const adjustedAPR = Math.max(0.05, safe(baseAPR, 0.20) + creditScoreAPRAdjustment(banking.creditScore.score));
  const card: CreditCard = {
    id: `card-${tier}-${openedWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Card`,
    tier,
    creditLimit: defaults.creditLimit,
    balance: 0,
    baseAPR: adjustedAPR,
    rewardsRate: defaults.rewardsRate,
    rewardsType: 'cashback',
    pendingRewards: 0,
    openedWeek,
    minCreditScore: defaults.minCreditScore,
    annualFee: defaults.annualFee,
  };

  const next: BankingState = {
    ...banking,
    creditCards: [...banking.creditCards, card],
    creditScore: {
      ...banking.creditScore,
      // R3-E: cap at 50 — the regular `updateCreditScore` filter only runs
      // after weekly tick, so spammed credit-card applications could grow
      // this unbounded inside a single week.
      inquiries: [...banking.creditScore.inquiries, { weeksLived: openedWeek, type: 'card' as const }].slice(-50),
    },
  };
  return { banking: next, ok: true, card };
}

export function chargeCreditCard(
  banking: BankingState,
  cardId: string,
  amount: number,
  /**
   * Floor for the cashback rate (decimal) from the Premium Credit Card IAP
   * ("10% cashback on all purchases"). The effective rate is the better of the
   * card's own rewardsRate and this floor, so the perk applies on top of any
   * card tier without ever reducing a higher built-in rate.
   */
  minRewardsRate?: number
): { banking: BankingState; ok: boolean; rewardsEarned: number; reason?: string } {
  const idx = banking.creditCards.findIndex((c) => c.id === cardId);
  if (idx === -1) return { banking, ok: false, rewardsEarned: 0, reason: 'Card not found' };
  const card = banking.creditCards[idx];
  const amt = Math.max(0, safe(amount));
  // R4-F: reject when the credit limit is missing/NaN/Infinity. The previous
  // check `balance + amt > creditLimit` evaluated to `NaN > NaN === false`,
  // so a corrupt card would let the player charge anything.
  const safeLimit = typeof card.creditLimit === 'number' && isFinite(card.creditLimit) && card.creditLimit > 0
    ? card.creditLimit
    : 0;
  if (safeLimit <= 0) return { banking, ok: false, rewardsEarned: 0, reason: 'Card has no usable credit limit' };
  if (safe(card.balance) + amt > safeLimit) {
    return { banking, ok: false, rewardsEarned: 0, reason: 'Over credit limit' };
  }
  // ANTI-EXPLOIT: cashback is accrued on SETTLEMENT (when the balance is paid
  // down in payCreditCard), NOT at charge time. Crediting rewards the instant a
  // charge posts — before any cash leaves the player — made cashback riskless
  // free money: charge to the limit, redeem the rewards, then pay the balance
  // later from the same cash. Charging now only increases the (interest-bearing)
  // balance; the player only earns rewards on money they actually repay.
  void minRewardsRate; // rate is applied at payment time, not here
  const next: BankingState = { ...banking, creditCards: [...banking.creditCards] };
  next.creditCards[idx] = {
    ...card,
    balance: safe(card.balance) + amt,
  };
  return { banking: next, ok: true, rewardsEarned: 0 };
}

export function payCreditCard(
  banking: BankingState,
  cardId: string,
  fromAccountId: string,
  amount: number,
  currentWeek: number,
  /** Cashback-rate floor from the Premium Credit Card IAP (decimal). */
  minRewardsRate?: number
): { banking: BankingState; ok: boolean; reason?: string } {
  const cardIdx = banking.creditCards.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return { banking, ok: false, reason: 'Card not found' };
  const card = banking.creditCards[cardIdx];
  const amt = Math.min(safe(card.balance), Math.max(0, safe(amount)));
  if (amt === 0) return { banking, ok: false, reason: 'Card has zero balance' };

  const withdrawn = withdrawFromAccount(banking, fromAccountId, amt, currentWeek);
  if (!withdrawn.ok) return withdrawn;

  const next: BankingState = { ...withdrawn.banking, creditCards: [...withdrawn.banking.creditCards] };
  // R4-F: track on-time payment behavior so creditScore can actually reward
  // responsible card use. Without this, paying off cards never improved the
  // score even though missing them could lower it (one-sided ratchet).
  const cardWithHistory = card as typeof card & {
    lastPaymentWeek?: number;
    onTimePayments?: number;
  };
  // Cashback accrues here, on the amount actually REPAID (see chargeCreditCard).
  // This keeps cashback a discount on settled spend rather than free cash.
  const effectiveRate = Math.max(
    safe(card.rewardsRate),
    typeof minRewardsRate === 'number' && isFinite(minRewardsRate) ? Math.max(0, minRewardsRate) : 0
  );
  const rewards = amt * effectiveRate;
  next.creditCards[cardIdx] = {
    ...card,
    balance: safe(card.balance) - amt,
    pendingRewards: safe(card.pendingRewards) + rewards,
    lastPaymentWeek: currentWeek,
    onTimePayments: (cardWithHistory.onTimePayments ?? 0) + 1,
  } as typeof card;
  return { banking: next, ok: true };
}

/**
 * Redeem pending credit-card rewards. Returns the dollar amount that should
 * be deposited into `stats.money` (the caller is responsible for the deposit
 * since `BankingState` doesn't own the money slice).
 *
 * R5-F: previously `pendingRewards` accumulated on charge but there was no
 * way to redeem them — so they sat on the card forever. Worse, `pendingRewards`
 * also had no cap, so an exploit-chasing player could rack up huge values
 * that bloated the save.
 */
export function redeemCardRewards(
  banking: BankingState,
  cardId: string
): { banking: BankingState; redeemed: number; reason?: string } {
  const idx = banking.creditCards.findIndex((c) => c.id === cardId);
  if (idx === -1) return { banking, redeemed: 0, reason: 'Card not found' };
  const card = banking.creditCards[idx];
  const pending = Math.max(0, safe(card.pendingRewards));
  if (pending <= 0) return { banking, redeemed: 0, reason: 'No pending rewards to redeem' };
  // Cap each redemption at $10,000 so a corrupt card with Infinity rewards
  // can't crash the cash slice.
  const redeemed = Math.min(pending, 10_000);
  const next: BankingState = { ...banking, creditCards: [...banking.creditCards] };
  next.creditCards[idx] = { ...card, pendingRewards: pending - redeemed };
  return { banking: next, redeemed };
}

// ---------------------------------------------------------------------------
// Bill-pay rules + tick
// ---------------------------------------------------------------------------

export function addBillPayRule(
  banking: BankingState,
  rule: Omit<BillPayRule, 'id' | 'missedCount'>
): { banking: BankingState; rule: BillPayRule } {
  const full: BillPayRule = {
    id: `bill-${rule.source}-${rule.nextDueWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    ...rule,
    missedCount: 0,
  };
  return { banking: { ...banking, billPayRules: [...banking.billPayRules, full] }, rule: full };
}

export function removeBillPayRule(banking: BankingState, ruleId: string): BankingState {
  return { ...banking, billPayRules: banking.billPayRules.filter((r) => r.id !== ruleId) };
}

/**
 * Run all bill-pay rules that are due on the given week.
 * Returns the updated banking slice, the rules that successfully paid, and the rules that
 * failed (so the action layer can apply a credit-score hit and late-fee deduction elsewhere).
 */
export function tickBillPay(
  banking: BankingState,
  currentWeek: number,
  lateFee: number = 35
): {
  banking: BankingState;
  paid: { rule: BillPayRule; amount: number }[];
  missed: { rule: BillPayRule; amount: number }[];
} {
  let next: BankingState = banking;
  const paid: { rule: BillPayRule; amount: number }[] = [];
  const missed: { rule: BillPayRule; amount: number }[] = [];
  let lateFees = 0;

  // Walk rules sequentially. Each iteration may mutate `next` (account balances,
  // budget spend) and produces a new BillPayRule for the updated array.
  const updatedRules: BillPayRule[] = next.billPayRules.map((rule) => {
    if (!rule.enabled || rule.nextDueWeek > currentWeek) return rule;
    // R4-J: skip rules whose amount is zero/negative/non-finite. Without this,
    // `withdrawFromAccount` rejects them (its safe() coerces to 0), the rule is
    // marked missed, and a $35 late fee gets applied to a fictional debt.
    if (!isFinite(rule.amount) || rule.amount <= 0) {
      const cadenceWeeks = rule.cadence === 'weekly' ? 1 : 4;
      return {
        ...rule,
        nextDueWeek: rule.nextDueWeek + cadenceWeeks,
      };
    }
    const cadenceWeeks = rule.cadence === 'weekly' ? 1 : 4;

    const debit = withdrawFromAccount(next, rule.fromAccountId, rule.amount, currentWeek);
    if (debit.ok) {
      next = debit.banking;
      next = trackBudgetSpend(next, currentWeek, rule.category, rule.amount);
      paid.push({ rule, amount: rule.amount });
      return {
        ...rule,
        lastPaidWeek: currentWeek,
        nextDueWeek: rule.nextDueWeek + cadenceWeeks,
        missedCount: 0,
      };
    }

    missed.push({ rule, amount: rule.amount });
    lateFees += lateFee;
    return {
      ...rule,
      nextDueWeek: rule.nextDueWeek + cadenceWeeks,
      missedCount: safe(rule.missedCount) + 1,
    };
  });

  next = {
    ...next,
    billPayRules: updatedRules,
    totalLateFeesPaid: safe(next.totalLateFeesPaid) + lateFees,
  };

  return { banking: next, paid, missed };
}

// ---------------------------------------------------------------------------
// Budget tracking
// ---------------------------------------------------------------------------

export function trackBudgetSpend(
  banking: BankingState,
  currentWeek: number,
  category: BudgetCategory,
  amount: number
): BankingState {
  const amt = Math.max(0, safe(amount));
  if (amt === 0) return banking;

  const buckets = [...banking.budgetSpend];
  let bucket = buckets.find((b) => b.weeksLived === currentWeek);
  if (!bucket) {
    bucket = { weeksLived: currentWeek, byCategory: {} };
    buckets.push(bucket);
  } else {
    const i = buckets.indexOf(bucket);
    bucket = { weeksLived: currentWeek, byCategory: { ...bucket.byCategory } };
    buckets[i] = bucket;
  }
  bucket.byCategory[category] = safe(bucket.byCategory[category]) + amt;

  // Cap to last N weeks.
  buckets.sort((a, b) => a.weeksLived - b.weeksLived);
  const capped = buckets.slice(-BUDGET_BUCKET_CAP);

  return { ...banking, budgetSpend: capped };
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

export function addSavingsGoal(
  banking: BankingState,
  goal: Omit<SavingsGoal, 'id' | 'currentAmount'>
): { banking: BankingState; goal: SavingsGoal } {
  const full: SavingsGoal = {
    id: `goal-${goal.category}-${goal.createdWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    currentAmount: 0,
    ...goal,
  };
  return { banking: { ...banking, savingsGoals: [...banking.savingsGoals, full] }, goal: full };
}

export function contributeToGoal(
  banking: BankingState,
  goalId: string,
  amount: number
): { banking: BankingState; ok: boolean; reason?: string } {
  const idx = banking.savingsGoals.findIndex((g) => g.id === goalId);
  if (idx === -1) return { banking, ok: false, reason: 'Goal not found' };
  const amt = Math.max(0, safe(amount));
  if (amt === 0) return { banking, ok: false, reason: 'Amount must be positive' };

  const next: BankingState = { ...banking, savingsGoals: [...banking.savingsGoals] };
  next.savingsGoals[idx] = { ...next.savingsGoals[idx], currentAmount: safe(next.savingsGoals[idx].currentAmount) + amt };
  return { banking: next, ok: true };
}

// ---------------------------------------------------------------------------
// Loans (interaction with the legacy Loan[] array on GameState)
// ---------------------------------------------------------------------------

/**
 * Quote a new loan given borrower context. Returns null if rejected.
 */
export function quoteLoan(
  banking: BankingState,
  loans: Loan[],
  request: {
    principal: number;
    termWeeks: number;
    type: Loan['type'];
    weeklyIncome: number;
    /** Political-perk APR reduction (decimal, e.g. 0.05 = 5% off). Computed by the caller from gameState.politics. */
    aprReduction?: number;
    /** Hard APR cap (decimal) from the Private Banking IAP — caps the offered rate (e.g. 0.03 = "VIP 3% APR"). */
    aprCap?: number;
  }
): { rejected: false; offeredAPR: number; weeklyPayment: number; totalRepaid: number } | { rejected: true; reason: string } {
  const minScore = MIN_SCORE_BY_LOAN_TYPE[request.type];
  if (banking.creditScore.score < minScore) {
    return { rejected: true, reason: `Need credit score ≥ ${minScore} for a ${request.type} loan` };
  }
  if (safe(request.principal) <= 0 || safe(request.termWeeks) <= 0) {
    return { rejected: true, reason: 'Invalid loan terms' };
  }

  // Base APR by loan type, credit-score adjustment, and politics perk discount.
  const baseByType: Record<Loan['type'], number> = {
    personal: 0.12,
    auto: 0.08,
    business: 0.10,
    mortgage: 0.065,
  };
  const aprReduction = Math.max(0, Math.min(0.2, safe(request.aprReduction, 0)));
  let offeredAPR = Math.max(
    0.025,
    baseByType[request.type] + creditScoreAPRAdjustment(banking.creditScore.score) - aprReduction
  );
  // Private Banking IAP caps the rate (never below the 0.025 floor).
  if (typeof request.aprCap === 'number' && isFinite(request.aprCap)) {
    offeredAPR = Math.min(offeredAPR, Math.max(0.025, request.aprCap));
  }
  const weeklyPayment = calculatePeriodicPayment(request.principal, offeredAPR, request.termWeeks);
  const existingDebtPayments = (loans ?? []).reduce((s, l) => s + safe(l.weeklyPayment), 0);

  if (exceedsDTI(request.weeklyIncome, existingDebtPayments, weeklyPayment)) {
    return { rejected: true, reason: 'Debt-to-income ratio too high' };
  }

  return {
    rejected: false,
    offeredAPR,
    weeklyPayment,
    totalRepaid: weeklyPayment * request.termWeeks,
  };
}

/**
 * Apply a single weekly loan payment. Returns updated loan, banking, and whether it was on-time.
 */
export function applyLoanPayment(
  banking: BankingState,
  loan: Loan,
  fromAccountId: string,
  currentWeek: number
): {
  banking: BankingState;
  loan: Loan;
  paid: boolean;
  interest: number;
  principal: number;
} {
  const split = splitPayment(loan.remaining, loan.rateAPR, loan.weeklyPayment);
  const debit = withdrawFromAccount(banking, fromAccountId, loan.weeklyPayment, currentWeek);

  if (!debit.ok) {
    return {
      banking,
      loan: {
        ...loan,
        latePayments: safe(loan.latePayments) + 1,
      },
      paid: false,
      interest: 0,
      principal: 0,
    };
  }

  const nextBanking: BankingState = {
    ...debit.banking,
    totalInterestPaid: safe(debit.banking.totalInterestPaid) + split.interest,
  };
  const nextLoan: Loan = {
    ...loan,
    remaining: split.newBalance,
    weeksRemaining: Math.max(0, safe(loan.weeksRemaining) - 1),
    onTimePayments: safe(loan.onTimePayments) + 1,
    lastPaidWeek: currentWeek,
  };

  return {
    banking: trackBudgetSpend(nextBanking, currentWeek, 'debt', loan.weeklyPayment),
    loan: nextLoan,
    paid: true,
    interest: split.interest,
    principal: split.principal,
  };
}

// ---------------------------------------------------------------------------
// Credit score recompute
// ---------------------------------------------------------------------------

/**
 * Rebuild the credit score from the current state of accounts, cards, loans, and history.
 * Cheap enough to run on every week tick.
 */
export function recomputeCreditScore(
  banking: BankingState,
  loans: Loan[],
  currentWeek: number
): BankingState {
  const onTime = (loans ?? []).reduce((s, l) => s + safe(l.onTimePayments), 0);
  const late = (loans ?? []).reduce((s, l) => s + safe(l.latePayments), 0);

  const ages = banking.accounts.map((a) => Math.max(0, currentWeek - safe(a.openedWeek)));
  const avgAge = ages.length === 0 ? 0 : ages.reduce((s, a) => s + a, 0) / ages.length;

  const hasMortgage = (loans ?? []).some((l) => l.type === 'mortgage' && safe(l.remaining) > 0);
  const hasLoan = (loans ?? []).some((l) => safe(l.remaining) > 0);

  // Count distinct account types as: checking, savings (any flavor), card (if any).
  const typeSet = new Set<string>();
  banking.accounts.forEach((a) => typeSet.add(a.type === 'checking' ? 'checking' : 'savings'));
  if (banking.creditCards.length > 0) typeSet.add('card');

  const recentInquiries = banking.creditScore.inquiries.filter(
    (i) => currentWeek - i.weeksLived <= INQUIRY_LOOKBACK_WEEKS
  );

  const result = computeCreditScore({
    onTimePayments: onTime,
    latePayments: late,
    totalCreditCardBalance: totalCreditCardDebt(banking),
    totalCreditCardLimit: totalCreditLimit(banking),
    averageAccountAgeWeeks: avgAge,
    distinctAccountTypes: typeSet.size,
    recentInquiryCount: recentInquiries.length,
    hasOpenLoan: hasLoan,
    hasOpenMortgage: hasMortgage,
  });

  const nextHistory = [
    ...banking.creditScore.history,
    { weeksLived: currentWeek, score: result.score },
  ].slice(-HISTORY_CAP);

  return {
    ...banking,
    creditScore: {
      score: result.score,
      band: result.band,
      componentBreakdown: result.breakdown,
      lastUpdatedWeek: currentWeek,
      history: nextHistory,
      inquiries: recentInquiries,
    },
  };
}
