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
import { SAVINGS_BALANCE_SOFT_CAP, SAVINGS_CAP_EFFICIENCY } from '@/lib/economy/constants';
import { effectiveDepositAPR, effectiveLoanAPR } from './rateEnvironment';
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
 * The savings mirror, named on its own because it is the ONE mirror the player
 * may move money in and out of.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "The default savings account that links to
 * the gold piggy still does not work."
 *
 * He was right, and the previous fix addressed a different half of it. The HUD's
 * gold chip renders `bankSavings`, and `bankSavings` had exactly three non-test
 * writers — the interest tick, the divorce split, and the estate reader. Nothing
 * deposited into it, so interest on a balance of 0 kept it at 0 for the whole
 * life. Opening a SECOND savings account (the earlier fix) works, but that money
 * lands in `banking.accounts` and the chip never moves.
 *
 * The read-only rule exists because a manual write to a mirror's `balance` is
 * erased by the next `mirrorAccountsFromLegacy` pass — destroying a deposit and
 * printing a withdrawal. That reasoning bans writing the BALANCE; it does not
 * ban moving the money. Deposits and withdrawals on this account are therefore
 * routed through `bankSavings` — the authoritative field the mirror reflects —
 * so the tick has nothing to overwrite and the round trip conserves value.
 *
 * `checking-default` gets no such treatment and stays fully read-only: it
 * mirrors `stats.money`, so "moving cash into your cash" is not a transaction.
 */
export const LEGACY_SAVINGS_ACCOUNT_ID = 'savings-default';

/**
 * The checking mirror. Fully read-only — see below.
 */
export const LEGACY_CHECKING_ACCOUNT_ID = 'checking-default';

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
  LEGACY_CHECKING_ACCOUNT_ID,
  // Derived, not repeated. The id lived here as a literal AND in
  // `LEGACY_SAVINGS_ACCOUNT_ID`; if one were renamed the savings carve-out would
  // stop matching the mirror set and deposits would silently fall through to the
  // read-only rejection — the exact bug this whole area exists to fix.
  LEGACY_SAVINGS_ACCOUNT_ID,
]);

/**
 * Does this account reject manual cash movement entirely?
 *
 * `checking-default` does; `savings-default` does not (it routes through
 * `bankSavings`). Three components re-derived that distinction inline, this PR
 * had to edit all three when the rule changed, and a future change that misses
 * one leaves the surfaces disagreeing about whether the gold piggy takes
 * deposits. One definition, called everywhere.
 */
export const isReadOnlyMirror = (accountId: string): boolean =>
  MIRRORED_ACCOUNT_IDS.has(accountId) && accountId !== LEGACY_SAVINGS_ACCOUNT_ID;

/**
 * May the player close this account?
 *
 * Never a mirror — neither one is an account the player opened, and closing one
 * would mean deleting their cash or their savings. `closeAccount` already
 * rejects both; this is the same rule stated where the UI can ask it, so a Close
 * button is not offered for something that will always refuse.
 */
export const canCloseAccount = (accountId: string): boolean =>
  !MIRRORED_ACCOUNT_IDS.has(accountId);

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

/**
 * Sum of deposits that are NOT mirror accounts. The mirror accounts
 * (`checking-default`, `savings-default`) are 1:1 reflections of the legacy
 * `stats.money` / `bankSavings` fields; anything that also counts those legacy
 * fields must exclude the mirrors here to avoid double-counting cash/savings.
 */
export function nonMirrorDeposits(accounts: readonly BankAccount[]): number {
  // `a?.id`, not `a.id`: a corrupt save can carry a null row, and this now runs
  // inside `netWorth` — which the leaderboard, the HUD and the prestige gate
  // all call. A throw there is a blank screen rather than a wrong number.
  return (accounts ?? []).reduce(
    (sum, a) => (MIRRORED_ACCOUNT_IDS.has(a?.id) ? sum : sum + safe(a?.balance)),
    0
  );
}

export interface StatementNetWorthInput {
  cash: number; // stats.money (mirrored by checking-default)
  bankSavings: number; // legacy bankSavings (mirrored by savings-default)
  accounts: readonly BankAccount[];
  stocks: number;
  crypto: number;
  realEstate: number;
  cardDebt: number;
  loanDebt: number;
}

export interface StatementNetWorth {
  bankDeposits: number; // savings + self-opened accounts (excludes the cash mirror)
  assets: number;
  liabilities: number;
  net: number;
}

/**
 * Net-worth composition for the desktop bank statement. Counts each
 * authoritative money pool exactly once: `cash` + `bankSavings` +
 * self-opened (non-mirror) account balances + investments. Summing the raw
 * account list alongside `cash` would double-count the checking mirror.
 */
export function computeStatementNetWorth(input: StatementNetWorthInput): StatementNetWorth {
  const bankDeposits = safe(input.bankSavings) + nonMirrorDeposits(input.accounts);
  const assets =
    safe(input.cash) + bankDeposits + safe(input.stocks) + safe(input.crypto) + safe(input.realEstate);
  const liabilities = safe(input.cardDebt) + safe(input.loanDebt);
  return { bankDeposits, assets, liabilities, net: assets - liabilities };
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

/**
 * Accrue one week of interest on every self-opened account.
 *
 * The two mirrored legacy accounts are skipped — `savings-default` is paid by
 * the legacy applySavingsInterest path and `checking-default` mirrors cash.
 * Uses the same soft-cap diminishing-returns curve as the legacy path so a
 * parked fortune doesn't compound at full rate. Locked accounts (CDs) still
 * accrue — that's the point of a CD.
 */
export function accrueAccountInterest(
  banking: BankingState,
  /**
   * Live-rate-environment deposit multiplier (1 = neutral). Sourced from the
   * weekly tick's `economyState`. The resulting APY is clamped to
   * `SAVINGS_APR_HARD_CAP` inside `effectiveDepositAPR`, so no boost can open a
   * borrow-low/save-high arbitrage (asserted by the rateEnvironment invariant test).
   */
  depositMult = 1
): { banking: BankingState; totalInterest: number } {
  let totalInterest = 0;
  const env = { depositMult, loanDelta: 0 };

  /**
   * R3-M6: the soft cap is a PORTFOLIO allowance, not a per-account one.
   *
   * `SAVINGS_BALANCE_SOFT_CAP` ($500k, 25% efficiency above it) is documented
   * as an anti-exploit diminishing-returns curve, and `applySavingsInterest`
   * applies it to the single legacy pool exactly that way. Here it was applied
   * inside the per-account map, so every account got its own full $500k of
   * uncapped balance — and `openNewAccount` deliberately exempts CDs from the
   * one-per-type rule, because laddering CDs is a real strategy. So $10M split
   * across 20 x $500k 52-week CDs earned the full 5.5% on every dollar
   * (~$550k/yr) instead of the intended ~$194k, and the curve the constant
   * exists to enforce was bypassed entirely by clicking "open account" more
   * times.
   *
   * The allowance is allocated PROPORTIONALLY to balance rather than by
   * iteration order, so the result does not depend on which account happens to
   * come first and each account keeps its own APR.
   */
  const eligible = (banking.accounts || []).filter(
    (a) => !MIRRORED_ACCOUNT_IDS.has(a.id) && safe(a.balance) > 0,
  );
  const totalEligibleBalance = eligible.reduce((sum, a) => sum + safe(a.balance), 0);
  const belowCapShareRatio =
    totalEligibleBalance > 0
      ? Math.min(1, SAVINGS_BALANCE_SOFT_CAP / totalEligibleBalance)
      : 0;

  const accounts = (banking.accounts || []).map((acct) => {
    if (MIRRORED_ACCOUNT_IDS.has(acct.id)) return acct;
    // Apply the live rate environment to the advertised base APY (clamped at the
    // regulatory hard cap). Neutral (depositMult=1) leaves the base rate intact.
    const apr = effectiveDepositAPR(safe(acct.baseAPR), env);
    const balance = safe(acct.balance);
    if (apr <= 0 || balance <= 0) return acct;
    const belowCap = balance * belowCapShareRatio;
    const aboveCap = Math.max(0, balance - belowCap);
    const interest =
      (belowCap * apr) / WEEKS_PER_YEAR +
      (aboveCap * apr * SAVINGS_CAP_EFFICIENCY) / WEEKS_PER_YEAR;
    if (interest <= 0) return acct;
    totalInterest += interest;
    return { ...acct, balance: balance + interest };
  });
  if (totalInterest === 0) return { banking, totalInterest: 0 };
  return { banking: { ...banking, accounts }, totalInterest };
}

/**
 * Close a self-opened account. The residual balance is returned to the caller,
 * which must credit it to the player's cash (action layer responsibility).
 */
export function closeAccount(
  banking: BankingState,
  accountId: string,
  currentWeek: number
): { banking: BankingState; ok: boolean; residualBalance: number; reason?: string } {
  const account = findAccount(banking, accountId);
  if (!account) {
    return { banking, ok: false, residualBalance: 0, reason: 'Account not found' };
  }
  if (MIRRORED_ACCOUNT_IDS.has(accountId)) {
    return { banking, ok: false, residualBalance: 0, reason: 'Your primary checking and savings accounts cannot be closed' };
  }
  if (account.lockUntilWeek && currentWeek < account.lockUntilWeek) {
    return { banking, ok: false, residualBalance: 0, reason: `Locked until week ${account.lockUntilWeek}` };
  }
  const residualBalance = Math.max(0, safe(account.balance));
  return {
    banking: { ...banking, accounts: banking.accounts.filter((a) => a.id !== accountId) },
    ok: true,
    residualBalance,
  };
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

/** Pause/resume a bill-pay rule without deleting it. */
export function toggleBillPayRule(banking: BankingState, ruleId: string): BankingState {
  return {
    ...banking,
    billPayRules: banking.billPayRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ),
  };
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

  // Defend against a partial/older banking slice with no budgetSpend array.
  // The weekly-tick spendEvents loop (lib/banking/weeklyTick.ts) calls this
  // EVERY tick, so an unguarded `[...undefined]` here would throw inside the
  // tick updater and soft-lock "Next Week". Every other caller guards this;
  // defaulting at the source covers them all.
  const buckets = [...(banking.budgetSpend || [])];
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

/**
 * v22 Wave A (computer-only): set — or clear — a weekly budget cap for a category.
 * A non-positive / non-finite amount clears the target. Informational only: no
 * money moves, so this carries zero economy risk (audit AdvancedBankApp proposal).
 */
export function setBudgetTarget(
  banking: BankingState,
  category: BudgetCategory,
  amount: number
): BankingState {
  const targets: Partial<Record<BudgetCategory, number>> = { ...(banking.budgetTargets || {}) };
  const amt = safe(amount);
  if (amt > 0) {
    targets[category] = amt;
  } else {
    delete targets[category];
  }
  return { ...banking, budgetTargets: targets };
}

/**
 * Detect categories whose spend in `currentWeek` exceeds their configured budget
 * target. Pure read — returns the list of `{ category, spent, target }` overruns
 * (empty when no targets are set or nothing is over). Used by the weekly tick to
 * raise a single overspend notification.
 */
export function detectBudgetOverspend(
  banking: BankingState,
  currentWeek: number
): { category: BudgetCategory; spent: number; target: number }[] {
  const targets = banking.budgetTargets || {};
  const bucket = (banking.budgetSpend || []).find((b) => b.weeksLived === currentWeek);
  if (!bucket) return [];
  const over: { category: BudgetCategory; spent: number; target: number }[] = [];
  for (const key of Object.keys(targets) as BudgetCategory[]) {
    const target = safe(targets[key]);
    if (target <= 0) continue;
    const spent = safe(bucket.byCategory[key]);
    if (spent > target) over.push({ category: key, spent, target });
  }
  return over;
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

/** Completion reward cap for a manually-funded goal: min(1% of target, $500). */
export const GOAL_COMPLETION_REWARD_CAP = 500;
/** Happiness granted on completing a savings goal. */
export const GOAL_COMPLETION_HAPPINESS = 4;

/**
 * Contribute REAL money to a savings goal (audit no-op fix). Previously this only
 * bumped `currentAmount`, minting a free cosmetic bar. Now:
 *   - the amount is clamped to what remains before the target (a goal can never
 *     exceed `targetAmount`);
 *   - money is pulled from a real source — the goal's `linkedAccountId` balance
 *     if set (assets conserved, handled here), otherwise the returned `cashDebit`
 *     tells the action layer how much to debit from `stats.money`;
 *   - reaching the target marks `completedWeek` exactly once and returns a bounded
 *     completion reward (happiness + `min(1% of target, $500)` cash) for the
 *     action to credit via the money helper.
 *
 * Returns `contributed` (actually moved into the goal) and `cashDebit` (the slice
 * of that funded from cash — 0 when funded from a linked account).
 */
export function contributeToGoal(
  banking: BankingState,
  goalId: string,
  amount: number,
  currentWeek = 0
): {
  banking: BankingState;
  ok: boolean;
  reason?: string;
  /** Amount actually moved into the goal this call. */
  contributed: number;
  /** Portion of `contributed` that must be debited from cash by the action. */
  cashDebit: number;
  /** Bounded completion reward the action credits via applyMoneyDelta. */
  rewardCash: number;
  /** Happiness the action adds on completion. */
  happinessDelta: number;
  /** True if this call completed the goal. */
  completed: boolean;
} {
  const reject = (reason: string) => ({
    banking, ok: false, reason, contributed: 0, cashDebit: 0, rewardCash: 0, happinessDelta: 0, completed: false,
  });

  const idx = banking.savingsGoals.findIndex((g) => g.id === goalId);
  if (idx === -1) return reject('Goal not found');
  const requested = Math.max(0, safe(amount));
  if (requested === 0) return reject('Amount must be positive');

  const goal = banking.savingsGoals[idx];
  if (typeof goal.completedWeek === 'number') return reject('Goal already completed');

  const target = safe(goal.targetAmount);
  const current = Math.max(0, safe(goal.currentAmount));
  const remainingToTarget = target > 0 ? Math.max(0, target - current) : requested;
  if (remainingToTarget <= 0) return reject('Goal already funded');

  const accounts = [...banking.accounts];
  let contributed = 0;
  let cashDebit = 0;

  // Prefer pulling from a real linked account (assets conserved here). Mirrored
  // accounts are read-only cash mirrors — never fund from them (that would print).
  const linkedIdx = goal.linkedAccountId
    ? accounts.findIndex((a) => a.id === goal.linkedAccountId && !MIRRORED_ACCOUNT_IDS.has(a.id))
    : -1;
  if (linkedIdx !== -1) {
    const available = Math.max(0, safe(accounts[linkedIdx].balance));
    contributed = Math.min(requested, remainingToTarget, available);
    if (contributed <= 0) return reject('Linked account has no funds');
    accounts[linkedIdx] = { ...accounts[linkedIdx], balance: available - contributed };
  } else {
    // Fund from cash — the action layer debits `cashDebit` from stats.money.
    contributed = Math.min(requested, remainingToTarget);
    cashDebit = contributed;
  }

  const nextGoals = [...banking.savingsGoals];
  const nextCurrent = Math.min(target > 0 ? target : current + contributed, current + contributed);

  let completed = false;
  let rewardCash = 0;
  let happinessDelta = 0;
  let completedWeek: number | undefined = goal.completedWeek;
  if (target > 0 && nextCurrent >= target) {
    completed = true;
    completedWeek = currentWeek;
    happinessDelta = GOAL_COMPLETION_HAPPINESS;
    rewardCash = Math.min(GOAL_COMPLETION_REWARD_CAP, Math.floor(target * 0.01));
  }

  nextGoals[idx] = { ...goal, currentAmount: nextCurrent, completedWeek };
  const next: BankingState = { ...banking, accounts, savingsGoals: nextGoals };
  return { banking: next, ok: true, contributed, cashDebit, rewardCash, happinessDelta, completed };
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
    /**
     * Hard floor for the offered APR, overriding the default 0.025.
     *
     * Callers applying an `aprReduction` that could otherwise cross the deposit
     * hard cap pass this. `SAVINGS_APR_HARD_CAP` is 5.5% and the anti-arbitrage
     * contract (rateEnvironment.ts:12-21) requires the cheapest loan to stay
     * strictly above it — the 0.025 default does not, so any large reduction
     * opens a risk-free borrow-low/save-high carry. R3-M2.
     */
    aprFloor?: number;
    /** Hard APR cap (decimal) from the Private Banking IAP — caps the offered rate (e.g. 0.03 = "VIP 3% APR"). */
    aprCap?: number;
    /**
     * Live-rate-environment additive loan delta (decimal APR; +raises, −cheapens).
     * Sourced from `banking.rateEnvironment.loanDelta`. Applied AFTER the credit /
     * politics adjustments and floored at the same 0.025 floor via `effectiveLoanAPR`.
     */
    loanDelta?: number;
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
  const aprFloor = typeof request.aprFloor === 'number' && isFinite(request.aprFloor)
    ? Math.max(0.025, request.aprFloor)
    : 0.025;
  let offeredAPR = Math.max(
    aprFloor,
    baseByType[request.type] + creditScoreAPRAdjustment(banking.creditScore.score) - aprReduction
  );
  // Private Banking IAP caps the rate (never below the 0.025 floor).
  if (typeof request.aprCap === 'number' && isFinite(request.aprCap)) {
    offeredAPR = Math.min(offeredAPR, Math.max(aprFloor, request.aprCap));
  }
  // Live rate environment: recession/crash raise the offered rate, boom cheapens
  // it. Floored at the same 0.025 floor. The rateEnvironment invariant test keeps
  // the cheapest boom-adjusted loan above the deposit hard cap (no arbitrage).
  if (typeof request.loanDelta === 'number' && isFinite(request.loanDelta) && request.loanDelta !== 0) {
    offeredAPR = effectiveLoanAPR(offeredAPR, { depositMult: 1, loanDelta: request.loanDelta });
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
  currentWeek: number,
  /**
   * Standing arrears (v31 `overdueBalance`) — mandatory weekly bills the player
   * could not cover. Optional so the three other call sites keep their exact
   * behaviour; the weekly tick passes it.
   */
  overdueBalance = 0
): BankingState {
  const onTime = (loans ?? []).reduce((s, l) => s + safe(l.onTimePayments), 0);
  const loanLate = (loans ?? []).reduce((s, l) => s + safe(l.latePayments), 0);
  // Unpaid bills read as late payments, scaled by how deep the hole is.
  //
  // DERIVED from the standing balance rather than accumulated in a counter, so
  // it is self-correcting: the drag grows as the debt grows and disappears the
  // week it is cleared, with no separate state to drift out of sync. Capped so a
  // large one-off shortfall cannot floor the component on its own — arrears
  // should press on the player, not brick their credit.
  const arrearsLate = Math.min(6, Math.floor(Math.max(0, safe(overdueBalance)) / 500));
  const late = loanLate + arrearsLate;

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

/**
 * Take money back out of a savings goal.
 *
 * The counterpart `contributeToGoal` never had. Contributing debits real money
 * — from the goal's linked account, or from `stats.money` via `cashDebit` — into
 * `goal.currentAmount`, and there was no withdraw path, no delete-goal path, and
 * no refund on completion beyond the bounded reward. Every reader of
 * `currentAmount` outside the writers was display code, and `netWorth` did not
 * count it either, so the "Contribute" button (whose modal presets `maxAmount`
 * to the player's entire cash balance) permanently destroyed whatever it moved.
 * Funding a $25,000 goal to completion cost $25,000 and returned $250.
 * The weekly `autoContribute` sweep did the same silently, every week.
 * 2026-07-31 audit round 3, R3-M5.
 *
 * Returns money the same way it was taken: to the linked account when there is
 * one (assets conserved here), otherwise as `cashCredit` for the action layer
 * to credit through the money helper.
 *
 * A COMPLETED goal can still be withdrawn from — the money is the player's, and
 * refusing would recreate the trap in a narrower form — and `completedWeek`
 * SURVIVES the withdrawal, so the bounded completion reward cannot be farmed by
 * withdrawing and re-contributing. See the comment at the assignment.
 */
export function withdrawFromGoal(
  banking: BankingState,
  goalId: string,
  amount: number
): {
  banking: BankingState;
  ok: boolean;
  reason?: string;
  /** Amount actually taken out of the goal. */
  withdrawn: number;
  /** Portion returned as cash, for the action to credit. */
  cashCredit: number;
} {
  const reject = (reason: string) => ({
    banking, ok: false, reason, withdrawn: 0, cashCredit: 0,
  });

  const idx = banking.savingsGoals.findIndex((g) => g.id === goalId);
  if (idx === -1) return reject('Goal not found');

  const requested = Math.max(0, safe(amount));
  if (requested === 0) return reject('Amount must be positive');

  const goal = banking.savingsGoals[idx];
  const current = Math.max(0, safe(goal.currentAmount));
  if (current <= 0) return reject('Goal has no funds to withdraw');

  const withdrawn = Math.min(requested, current);
  const accounts = [...banking.accounts];
  let cashCredit = 0;

  // Return it where it came from. Mirrored accounts are read-only cash mirrors;
  // crediting one would print money, so those fall through to cash.
  const linkedIdx = goal.linkedAccountId
    ? accounts.findIndex((a) => a.id === goal.linkedAccountId && !MIRRORED_ACCOUNT_IDS.has(a.id))
    : -1;
  if (linkedIdx !== -1) {
    const balance = Math.max(0, safe(accounts[linkedIdx].balance));
    accounts[linkedIdx] = { ...accounts[linkedIdx], balance: balance + withdrawn };
  } else {
    cashCredit = withdrawn;
  }

  const nextGoals = [...banking.savingsGoals];
  nextGoals[idx] = {
    ...goal,
    currentAmount: current - withdrawn,
    // R4 correction. The first version of this cleared `completedWeek` when the
    // balance dropped below the target, with a comment claiming that stopped
    // the reward being farmed. It did the exact opposite.
    //
    // `contributeToGoal` rejects with "Goal already completed" while
    // `completedWeek` is a number (line 726), and `applySavingsGoals`'s weekly
    // auto-contribute gates on the same flag. Clearing it RE-ARMS both. So:
    // fund a $25,000 goal (+$250 reward), withdraw the whole $25,000 back,
    // contribute it again (+$250) — an unbounded printer at
    // GOAL_COMPLETION_REWARD_CAP per cycle, on money that never leaves the
    // player's hands, plus GOAL_COMPLETION_HAPPINESS each time.
    //
    // `completedWeek` records that the reward was PAID, which withdrawing does
    // not undo. It is now permanent. Withdrawal itself stays allowed — the
    // money is the player's — and refusing a re-contribution to a completed
    // goal is the behaviour that already shipped, so this adds no new trap.
    completedWeek: goal.completedWeek,
  };

  return {
    banking: { ...banking, accounts, savingsGoals: nextGoals },
    ok: true,
    withdrawn,
    cashCredit,
  };
}

/**
 * Accrue one week of interest on revolving credit-card balances.
 *
 * R3-M8: `CreditCard.baseAPR` was an inert definition. `chargeCreditCard` only
 * ever incremented `balance`; the advertised 17%-25% rates were rendered by
 * `ApplyCardModal` and `CreditCardRow`, and `AdvancedBankApp` even told the
 * player a charge "grows the (interest-bearing) balance now" — but no weekly
 * tick, action module or helper ever applied a card's APR to its balance. A
 * maxed-out $25,000 platinum card at a stated 17% APR (~$4,250/yr) cost exactly
 * $0 forever, so the only consequence of carrying a permanent balance was the
 * utilization component of the credit score. Combined with `netWorth` ignoring
 * `creditCards[].balance` (R3-M4), card debt was invisible on both the
 * cash-flow and the balance-sheet side.
 *
 * Interest capitalises onto the balance, which is how revolving credit works
 * and is what the UI copy already claims. Every value is finite-guarded: a
 * corrupt APR or balance must not turn a debt into NaN, because the credit
 * score's utilization ratio divides by it.
 */
export function accrueCreditCardInterest(
  banking: BankingState
): { banking: BankingState; totalInterest: number } {
  const cards = banking.creditCards || [];
  if (cards.length === 0) return { banking, totalInterest: 0 };

  let totalInterest = 0;
  const nextCards = cards.map((card) => {
    const balance = Math.max(0, safe(card?.balance));
    const apr = Math.max(0, safe(card?.baseAPR));
    if (balance <= 0 || apr <= 0) return card;

    const interest = (balance * apr) / WEEKS_PER_YEAR;
    if (!isFinite(interest) || interest <= 0) return card;

    totalInterest += interest;
    return { ...card, balance: balance + interest };
  });

  if (totalInterest <= 0) return { banking, totalInterest: 0 };
  return { banking: { ...banking, creditCards: nextCards }, totalInterest };
}
