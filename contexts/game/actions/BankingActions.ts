/**
 * Banking actions — thin wrappers around the pure helpers in lib/banking/operations.ts.
 *
 * Pattern mirrors MoneyActions: each export takes setGameState plus the args,
 * and updates state via the functional updater (so stale-state double-spend is impossible).
 *
 * Pure math lives in lib/banking/. This file is the React-aware adapter.
 */
import React from 'react';
import { GameState, BankAccountType, BudgetCategory, CreditCardTier, SavingsGoalCategory } from '../types';
import { logger } from '@/utils/logger';
import { initialGameState } from '../initialState';
import { applyMoneyDelta } from './MoneyActions';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  depositToAccount,
  withdrawFromAccount,
  transferBetweenAccounts,
  openAccount,
  closeAccount,
  toggleBillPayRule,
  applyForCreditCard,
  chargeCreditCard,
  payCreditCard,
  addBillPayRule,
  removeBillPayRule,
  addSavingsGoal,
  contributeToGoal,
  withdrawFromGoal,
  trackBudgetSpend,
  setBudgetTarget as setBudgetTargetOp,
  findCheckingAccount,
  recomputeCreditScore,
  MIRRORED_ACCOUNT_IDS,
  LEGACY_SAVINGS_ACCOUNT_ID,
} from '@/lib/banking/operations';

const log = logger.scope('BankingActions');

/** Defensive accessor — old saves may have no banking slice mid-render. */
function ensureBanking(state: GameState): GameState {
  if (state.banking) return state;
  return { ...state, banking: initialGameState.banking };
}

// ---------------------------------------------------------------------------
// Account operations
// ---------------------------------------------------------------------------

/**
 * Write a new legacy-savings balance onto BOTH the authoritative field and the
 * mirror row that reflects it, in one object.
 *
 * `bankSavings` is the source of truth; `savings-default.balance` is what the
 * Bank screen renders. Writing only the former leaves the account card showing a
 * stale number until the next weekly tick re-mirrors it, which reads as "the
 * deposit didn't work" — the exact complaint being fixed. Writing both keeps the
 * two in step immediately and makes `mirrorAccountsFromLegacy` a no-op re-sync
 * rather than a correction.
 */
function withLegacySavings(state: GameState, nextSavings: number): GameState {
  const safeNext = Number.isFinite(nextSavings) ? Math.max(0, nextSavings) : 0;
  const banking = state.banking;
  return {
    ...state,
    bankSavings: safeNext,
    banking: banking
      ? {
          ...banking,
          accounts: (banking.accounts || []).map((a) =>
            a?.id === LEGACY_SAVINGS_ACCOUNT_ID ? { ...a, balance: safeNext } : a
          ),
        }
      : banking,
  };
}

export const depositCashToAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  accountId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    // Affordability is re-checked against `prev` INSIDE the updater, not against
    // the caller's snapshot, so a double-tap in one React batch cannot deposit
    // the same dollars twice (CLAUDE.md §4.4).
    if (!Number.isFinite(amount) || amount <= 0 || amount > currentMoney) {
      log.warn(`Deposit rejected: amount=${amount}, available=${currentMoney}`);
      return prev;
    }
    // The savings mirror is a real deposit target — routed through `bankSavings`,
    // the field it reflects, so the weekly re-mirror has nothing to overwrite.
    // See LEGACY_SAVINGS_ACCOUNT_ID for why this one is not read-only.
    if (accountId === LEGACY_SAVINGS_ACCOUNT_ID) {
      const currentSavings =
        typeof state.bankSavings === 'number' && isFinite(state.bankSavings)
          ? Math.max(0, state.bankSavings)
          : 0;
      const debit = applyMoneyDelta(state, -amount, 'Deposit to savings');
      if (!debit) return prev;
      // Credit savings by what ACTUALLY left cash, exactly as the withdraw half
      // debits savings by what actually landed. See the long note there: writing
      // the requested `amount` on one side and letting `applyMoneyDelta` clamp
      // the other is how money gets created or destroyed at the boundaries.
      const moved = currentMoney - debit.stats.money;
      if (moved <= 0) return prev;
      return { ...withLegacySavings(state, currentSavings + moved), ...debit };
    }
    // checking-default still mirrors `stats.money`: moving cash into your own
    // cash is not a transaction, and writing the balance would be erased by the
    // next mirror tick (an unbounded money printer on the withdraw side).
    if (MIRRORED_ACCOUNT_IDS.has(accountId)) {
      log.warn(`Deposit rejected: ${accountId} mirrors cash and is read-only`);
      return prev;
    }
    /**
     * Debit cash through `applyMoneyDelta`, then credit the account with what
     * actually left — the same shape as every other money movement here.
     *
     * The direct `money: currentMoney - amount` write this replaces skipped
     * `dailySummary.moneyChange` entirely, while the WITHDRAW half credits it.
     * So a deposit followed by a withdrawal of the same sum reported a net
     * positive week even though cash had returned to exactly where it started.
     * (`totalMoneyEarned` was never affected — `NON_INCOME_REASON` already
     * excludes deposit/withdraw/savings/bank, which is what keeps the daily
     * "earn $X" gem challenges unfarmable.)
     */
    const debit = applyMoneyDelta(state, -amount, `Deposit to account ${accountId}`);
    if (!debit) return prev;
    const moved = currentMoney - debit.stats.money;
    if (moved <= 0) return prev;
    const result = depositToAccount(state.banking, accountId, moved);
    if (!result.ok) {
      log.warn(`Deposit failed: ${result.reason}`);
      return prev;
    }
    return {
      ...state,
      ...debit,
      banking: result.banking,
    };
  });
};

export const withdrawCashFromAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  accountId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Savings mirror: the other half of the deposit path. Debit `bankSavings`
    // (authoritative) and credit cash through applyMoneyDelta, so the round trip
    // conserves value and the next re-mirror is a no-op.
    if (accountId === LEGACY_SAVINGS_ACCOUNT_ID) {
      const currentSavings =
        typeof state.bankSavings === 'number' && isFinite(state.bankSavings)
          ? Math.max(0, state.bankSavings)
          : 0;
      const currentMoney =
        typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
      if (!Number.isFinite(amount) || amount <= 0 || amount > currentSavings) {
        log.warn(`Withdraw rejected: amount=${amount}, savings=${currentSavings}`);
        return prev;
      }
      const credit = applyMoneyDelta(state, amount, 'Withdraw from savings');
      if (!credit) return prev;
      /**
       * Debit savings by what ACTUALLY landed in cash, not by what was asked
       * for.
       *
       * `applyMoneyDelta` does not refuse an over-ceiling credit — it CLAMPS
       * (`Math.min(MONEY_CEILING, …)`) and returns a value. Debiting `amount`
       * while cash only rose by the clamped delta would silently destroy the
       * difference, which is the money-conservation failure the whole
       * read-only-mirror rule exists to prevent. `MONEY_CEILING` is
       * `MAX_SAFE_INTEGER`, so this is only reachable in an extreme late game —
       * but deriving the debit from the credit makes the invariant hold at every
       * balance instead of below a threshold.
       */
      const landed = credit.stats.money - currentMoney;
      if (landed <= 0) return prev; // nothing moved — don't burn the savings
      return { ...withLegacySavings(state, currentSavings - landed), ...credit };
    }
    // CRITICAL EXPLOIT FIX (C-1): checking-default mirrors stats.money. Crediting
    // cash here and letting the next mirror tick restore the account balance was
    // an unbounded money printer. There is nothing to withdraw FROM your own cash
    // mirror, so reject. (Real, self-opened accounts withdraw normally below.)
    if (MIRRORED_ACCOUNT_IDS.has(accountId)) {
      log.warn(`Withdraw rejected: ${accountId} mirrors cash and is read-only`);
      return prev;
    }
    const result = withdrawFromAccount(state.banking, accountId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Withdraw failed: ${result.reason}`);
      return prev;
    }
    // Route the cash credit through applyMoneyDelta so it respects MONEY_CEILING and
    // the isFinite guard (a raw `money + amount` write could overflow to Infinity).
    const credit = applyMoneyDelta(state, amount, `Withdraw from account ${accountId}`);
    if (!credit) return prev;
    return {
      ...state,
      ...credit,
      banking: result.banking,
    };
  });
};

export const transferBetweenOwnAccounts = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  fromId: string,
  toId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Transfers touching a mirrored account desync from legacy cash (printer when
    // moving out of it, money loss when moving into it). Reject; use deposit into
    // / withdraw out of a real self-opened account instead.
    if (MIRRORED_ACCOUNT_IDS.has(fromId) || MIRRORED_ACCOUNT_IDS.has(toId)) {
      log.warn('Transfer rejected: mirrored accounts are read-only');
      return prev;
    }
    const result = transferBetweenAccounts(state.banking, fromId, toId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Transfer failed: ${result.reason}`);
      return prev;
    }
    return { ...state, banking: result.banking };
  });
};

/** The account the player is asking to open. */
type OpenAccountSpec = {
  type: BankAccountType;
  name: string;
  initialDeposit: number;
  baseAPR: number;
  lockUntilWeek?: number;
  minBalance?: number;
};

export const openNewAccount = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  spec: OpenAccountSpec
): { success: boolean; message: string } => {
  const preview = resolveOpenAccount(gameState, spec);
  if (!preview.next) return preview.result;
  setGameState((prev) => resolveOpenAccount(prev, spec).next ?? prev);
  return preview.result;
};

/**
 * PURE: what does opening `spec` do to `from`?
 *
 * `next: null` means refuse. Called once against the caller's snapshot for the
 * outcome and once against `prev` for the state.
 *
 * ── Why (2026-08-15) ──────────────────────────────────────────────────────
 *
 * This used to hold `let result = { success: false, message: 'Could not open
 * the account.' }`, assign it from inside the updater, and return it after the
 * dispatch — the shape its own comment described as "captured from inside the
 * updater so the UI can explain a rejection". A capture is only readable for
 * the FIRST functional update of a React batch, so on any deferred dispatch the
 * sheet showed "Could not open the account." for an account that HAD been
 * opened and paid for. Same defect as the 2026-08-15 player report.
 */
function resolveOpenAccount(
  from: GameState,
  spec: OpenAccountSpec
): { result: { success: boolean; message: string }; next: GameState | null } {
  {
    const state = ensureBanking(from);
    if (!state.banking) return { result: { success: false, message: 'Could not open the account.' }, next: null };
    /**
     * One account per type (CDs excepted — laddering multiple CDs is a real
     * strategy). Duplicate savings/checking accounts confused players and there
     * was no way to remove them.
     *
     * PLAYER REPORT (1.4 bug-reports): "Savings is still broke on the bank
     * page. Can't deposit to it. Can't create a new savings."
     *
     * The check counted the MIRROR accounts. `initialGameState` ships
     * `savings-default` (type `savings`) and `checking-default` (type
     * `checking`) for every player from week 1 — they are 1:1 reflections of
     * `stats.money` / `bankSavings` that `mirrorAccountsFromLegacy` rewrites
     * every tick, not accounts the player opened. So "Savings", the FIRST and
     * most obvious option in `OpenAccountModal`, was permanently unopenable for
     * everyone, and it failed silently: a `log.warn`, then the sheet closed as
     * if it had succeeded.
     *
     * The other half of the same report follows from it. `AccountRow` shows no
     * deposit control for a mirrored account ("handled automatically"), so with
     * the only savings account being the mirror, there was nothing to deposit
     * into either.
     *
     * A mirror does not occupy the player's slot for that type.
     */
    const playerOpened = state.banking.accounts.filter((a) => !MIRRORED_ACCOUNT_IDS.has(a.id));
    if (spec.type !== 'cd' && playerOpened.some((a) => a.type === spec.type)) {
      log.warn(`Open account rejected: already have a ${spec.type} account`);
      return { result: { success: false, message: `You already have a ${spec.name} account.` }, next: null };
    }
    const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    // Reject a non-finite or negative deposit as well as an unaffordable one — a
    // negative initialDeposit previously passed the `> currentMoney` check and
    // credited free money (currentMoney - (-X) = +X).
    if (!Number.isFinite(spec.initialDeposit) || spec.initialDeposit < 0 || spec.initialDeposit > currentMoney) {
      log.warn(`Open account rejected: invalid or unaffordable initial deposit`);
      return {
        result: {
          success: false,
          message: `You need ${formatMoney(Math.max(0, spec.initialDeposit))} to open this account.`,
        },
        next: null,
      };
    }
    const opened = openAccount(state.banking, { ...spec, openedWeek: state.weeksLived });
    return {
      result: { success: true, message: `${spec.name} opened.` },
      next: {
        ...state,
        stats: { ...state.stats, money: currentMoney - spec.initialDeposit },
        banking: opened.banking,
      },
    };
  }
}

export const closeBankAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  accountId: string
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = closeAccount(state.banking, accountId, state.weeksLived);
    if (!result.ok) {
      log.warn(`Close account failed: ${result.reason}`);
      return prev;
    }
    // Residual balance returns to cash through applyMoneyDelta (MONEY_CEILING +
    // isFinite guards), mirroring withdrawCashFromAccount.
    if (result.residualBalance > 0) {
      const credit = applyMoneyDelta(state, result.residualBalance, `Close account ${accountId}`);
      if (!credit) return prev;
      return { ...state, ...credit, banking: result.banking };
    }
    return { ...state, banking: result.banking };
  });
};

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------

export const applyForCard = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  tier: CreditCardTier,
  baseAPR = 0.20
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = applyForCreditCard(state.banking, tier, baseAPR, state.weeksLived);
    if (!result.ok) {
      log.info(`Card application rejected: ${result.reason}`);
      return prev;
    }
    log.info(`Approved for ${tier} card (APR ${(result.card!.baseAPR * 100).toFixed(2)}%)`);
    return { ...state, banking: result.banking };
  });
};

export const spendOnCard = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cardId: string,
  amount: number,
  _reason: string
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Premium Credit Card IAP guarantees a 10% cashback floor on all card spend.
    const cashbackFloor = state.settings?.premiumCreditCard ? 0.1 : undefined;
    const result = chargeCreditCard(state.banking, cardId, amount, cashbackFloor);
    if (!result.ok) {
      log.warn(`Card charge failed: ${result.reason}`);
      return prev;
    }
    return { ...state, banking: result.banking };
  });
};

export const payDownCard = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cardId: string,
  fromAccountId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // EXPLOIT FIX (H-1): when paying from the mirrored checking account, the debit
    // landed only on the account balance, which the next mirror tick restored from
    // stats.money — i.e. free debt repayment. Compute the amount actually paid and
    // debit authoritative stats.money so the payment really costs the player.
    const fundedFromCash = MIRRORED_ACCOUNT_IDS.has(fromAccountId);
    const card = state.banking.creditCards.find((c) => c.id === cardId);
    const cardBalanceBefore = typeof card?.balance === 'number' && isFinite(card.balance) ? card.balance : 0;
    // Premium Credit Card IAP cashback floor — applied at settlement (payment),
    // matching where rewards now accrue (see chargeCreditCard anti-exploit note).
    const cashbackFloor = state.settings?.premiumCreditCard ? 0.1 : undefined;
    // The mirrored checking balance is only re-synced from stats.money on the
    // weekly tick, but the pay modal caps against LIVE cash — so mid-week the
    // stale mirror could silently reject ("Insufficient funds") a payment the
    // player can afford, or fund one they can't. Refresh the mirror to live
    // cash before validating; the actual debit below hits stats.money anyway.
    let bankingForPay = state.banking;
    if (fundedFromCash) {
      const liveCash =
        typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
      bankingForPay = {
        ...state.banking,
        accounts: state.banking.accounts.map((a) =>
          a.id === fromAccountId ? { ...a, balance: liveCash } : a
        ),
      };
    }
    const result = payCreditCard(bankingForPay, cardId, fromAccountId, amount, state.weeksLived, cashbackFloor);
    if (!result.ok) {
      log.warn(`Card pay failed: ${result.reason}`);
      return prev;
    }
    // Derive the cash debit from what payCreditCard ACTUALLY applied (card balance
    // before − after), not an independently re-computed estimate that could drift
    // from the helper's own clamping.
    const cardAfter = result.banking.creditCards.find((c) => c.id === cardId);
    const cardBalanceAfter = typeof cardAfter?.balance === 'number' && isFinite(cardAfter.balance) ? cardAfter.balance : cardBalanceBefore;
    const paid = Math.max(0, cardBalanceBefore - cardBalanceAfter);
    if (fundedFromCash) {
      const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
      return {
        ...state,
        banking: result.banking,
        stats: { ...state.stats, money: Math.max(0, currentMoney - paid) },
      };
    }
    return { ...state, banking: result.banking };
  });
};

/**
 * R5-F: redeem accumulated credit-card rewards as cash. Caps at $10,000 per
 * call (the helper enforces this). Updates `stats.money` and `banking` in a
 * single atomic setState so a same-batch double-tap can't double-redeem.
 */
export const redeemRewards = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cardId: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { redeemCardRewards } = require('@/lib/banking/operations');
    const result = redeemCardRewards(state.banking, cardId);
    if (result.redeemed <= 0) {
      log.warn(`Card redeem failed: ${result.reason ?? 'no rewards'}`);
      return prev;
    }
    // Route the cash credit through applyMoneyDelta so it respects MONEY_CEILING and
    // the isFinite guard (a raw `money + redeemed` write could overflow to Infinity).
    const credit = applyMoneyDelta(state, result.redeemed, `Card rewards redeem ${cardId}`);
    if (!credit) return prev;
    return {
      ...state,
      ...credit,
      banking: result.banking,
    };
  });
};

// ---------------------------------------------------------------------------
// Bill pay
// ---------------------------------------------------------------------------

export const addBill = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  rule: {
    label: string;
    category: BudgetCategory;
    amount: number;
    fromAccountId: string;
    cadence: 'weekly' | 'monthly';
    nextDueWeek: number;
    source: 'rent' | 'mortgage' | 'loan' | 'subscription' | 'utility' | 'card' | 'manual';
    sourceRefId?: string;
    enabled?: boolean;
  }
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = addBillPayRule(state.banking, {
      label: rule.label,
      category: rule.category,
      amount: rule.amount,
      fromAccountId: rule.fromAccountId,
      cadence: rule.cadence,
      nextDueWeek: rule.nextDueWeek,
      source: rule.source,
      sourceRefId: rule.sourceRefId,
      enabled: rule.enabled ?? true,
    });
    return { ...state, banking: result.banking };
  });
};

export const removeBill = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  ruleId: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: removeBillPayRule(state.banking, ruleId) };
  });
};

export const toggleBill = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  ruleId: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: toggleBillPayRule(state.banking, ruleId) };
  });
};

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

/**
 * Create a savings goal.
 *
 * `autoContribute` is accepted here because the weekly sweep that consumes it
 * — `contexts/game/actions/weekly/applySavingsGoals.ts` — has shipped, is
 * wired into the tick, and has its own test suite proving asset conservation
 * and idempotent completion... while NOTHING could ever set the field. This
 * signature omitted it and neither goal-creation modal collected it, so the
 * sweep ran every week over a value that was always `undefined`.
 *
 * Same reader-without-writer shape as `banking.taxDueThisYear` and the journal.
 * The field is optional on `SavingsGoal`, so an absent value still means "no
 * auto-contribution" — no migration, no version bump.
 */
export const createSavingsGoal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  goal: {
    name: string;
    targetAmount: number;
    category: SavingsGoalCategory;
    linkedAccountId?: string;
    targetWeek?: number;
    /** Dollars swept toward this goal each week. Omit or 0 for manual-only. */
    autoContribute?: number;
  }
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = addSavingsGoal(state.banking, {
      ...goal,
      // Clamp defensively: the sweep floors at 0 anyway, but a negative here
      // would read as a withdrawal target in any future consumer.
      autoContribute:
        typeof goal.autoContribute === 'number' && Number.isFinite(goal.autoContribute)
          ? Math.max(0, Math.round(goal.autoContribute))
          : undefined,
      createdWeek: state.weeksLived,
    });
    return { ...state, banking: result.banking };
  });
};

export const contributeToSavingsGoal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  goalId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Pure helper clamps to the target, pulls from a linked account (assets
    // conserved) or reports a cashDebit, and reports a bounded completion reward.
    const result = contributeToGoal(state.banking, goalId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Goal contribution failed: ${result.reason}`);
      return prev;
    }
    let working: GameState = { ...state, banking: result.banking };
    // Debit the cash-funded portion (audit fix — Contribute is no longer free).
    if (result.cashDebit > 0) {
      const debit = applyMoneyDelta(working, -result.cashDebit, `Savings goal contribution`);
      if (!debit) {
        log.warn('Goal contribution rejected: insufficient cash');
        return prev; // roll back — no partial funding.
      }
      working = { ...working, ...debit };
    }
    // Credit the bounded, once-only completion reward (≤ min(1% target, $500)).
    if (result.rewardCash > 0) {
      const credit = applyMoneyDelta(working, result.rewardCash, `Savings goal completed reward`);
      if (credit) working = { ...working, ...credit };
    }
    if (result.happinessDelta > 0) {
      const h = typeof working.stats.happiness === 'number' && isFinite(working.stats.happiness) ? working.stats.happiness : 0;
      working = { ...working, stats: { ...working.stats, happiness: Math.max(0, Math.min(100, h + result.happinessDelta)) } };
    }
    return working;
  });
};

/**
 * Take money back out of a savings goal.
 *
 * The action half of R3-M5. Without this, "Contribute" was a one-way door: the
 * cash left `stats.money`, landed in `goal.currentAmount`, and nothing could
 * ever get it back.
 */
export const withdrawFromSavingsGoal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  goalId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;

    const result = withdrawFromGoal(state.banking, goalId, amount);
    if (!result.ok) {
      log.warn(`Goal withdrawal failed: ${result.reason}`);
      return prev;
    }

    let working: GameState = { ...state, banking: result.banking };
    if (result.cashCredit > 0) {
      const credit = applyMoneyDelta(working, result.cashCredit, 'Savings goal withdrawal');
      // Roll back rather than move the money out of the goal and lose it — the
      // exact failure this whole fix exists to prevent.
      if (!credit) return prev;
      working = { ...working, ...credit };
    }
    return working;
  });
};

// ---------------------------------------------------------------------------
// Spending categorization (called from MoneyActions / other actions later in Phase B)
// ---------------------------------------------------------------------------

/**
 * v22 Wave A (computer-only): set or clear a weekly budget cap for a category.
 * Purely informational — the weekly tick raises an overspend notification when a
 * category's spend exceeds its cap. Zero economy risk (no money moves).
 */
export const setBudgetTarget = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  category: BudgetCategory,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: setBudgetTargetOp(state.banking, category, amount) };
  });
};

export const recordCategorizedSpend = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  category: BudgetCategory,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: trackBudgetSpend(state.banking, state.weeksLived, category, amount) };
  });
};

// ---------------------------------------------------------------------------
// Credit-score recompute (called from the weekly tick in Phase B)
// ---------------------------------------------------------------------------

export const refreshCreditScore = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return {
      ...state,
      banking: recomputeCreditScore(state.banking, state.loans ?? [], state.weeksLived),
    };
  });
};

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

export const getCheckingAccount = (state: GameState) => {
  if (!state.banking) return undefined;
  return findCheckingAccount(state.banking);
};

// ---------------------------------------------------------------------------
// Sponsored bonus (rewarded ad)
// ---------------------------------------------------------------------------

/** One sponsored bonus per in-game week. */
export const AD_CASH_BONUS_COOLDOWN_WEEKS = 1;

/** Floor — the bonus is never smaller than this, however poor the player is. */
export const AD_CASH_BONUS_MIN = 2_000;
/** Share of the player's worth paid out, once per in-game week. */
export const AD_CASH_BONUS_RATE = 0.02;
/**
 * Ceiling. Matches `AdRewardOrb`'s `REWARD_MAX` so the game's two cash ad
 * rewards top out at the same number instead of two unrelated ones.
 */
export const AD_CASH_BONUS_MAX = 500_000;

/**
 * The bank's weekly sponsored bonus, scaled off everything the player owns.
 *
 * Exported so the button quotes exactly what the action will pay — a reward
 * that advertises one number and grants another is the shape of every "silent
 * rejection" finding in this codebase.
 *
 * ── Why net worth, not cash ───────────────────────────────────────────────
 *
 * This used to read `stats.money` alone, floored at $50 and capped at $5,000.
 * Cash is the worst available proxy for how far along a player is: someone with
 * $40M in property, companies and stock but $300 in their wallet — an entirely
 * normal late-game shape, since idle cash earns nothing — was offered **$50**.
 * Meanwhile `AdRewardOrb` had already been fixed to scale off
 * `max(netWorth, cash) × 1.5%` with a $1,000 floor and a $500,000 cap, so the
 * game shipped two cash ad rewards on scales three orders of magnitude apart.
 *
 * `calculateNetWorth` delegates to the canonical `netWorth()` in
 * `lib/progress/achievements.ts`, which is genuinely "everything that has
 * worth": cash, legacy savings, self-opened accounts, savings goals, crypto,
 * stocks, real estate, companies, vehicles and luxury, minus card debt and
 * loans.
 *
 * `Math.max(netWorth, cash)` rather than net worth alone, matching the orb: net
 * worth subtracts debt, so a player who is cash-rich and mortgage-heavy would
 * otherwise be pushed to the floor by a number that says nothing about what
 * they can spend.
 *
 * The floor is what makes this worth watching an ad for early — 2% of a
 * starting $1,500 is $30 — and it binds until roughly $100k of worth, after
 * which the percentage takes over.
 */
export const getAdCashBonusAmount = (state: GameState): number => {
  const cash = typeof state.stats?.money === 'number' && isFinite(state.stats.money)
    ? Math.max(0, state.stats.money)
    : 0;
  let worth = 0;
  try {
    worth = calculateNetWorth(state);
  } catch (err) {
    // A corrupt save must degrade to the floor, never to a throw inside a
    // render — this feeds a button label on a screen the player can always open.
    // Logged rather than swallowed: silently paying every player the floor would
    // hide the underlying corruption indefinitely.
    log.error('getAdCashBonusAmount: calculateNetWorth failed, using the floor', err);
    worth = 0;
  }
  const base = Math.max(isFinite(worth) ? worth : 0, cash, 0);
  const raw = base * AD_CASH_BONUS_RATE;
  const clamped = Math.max(AD_CASH_BONUS_MIN, Math.min(AD_CASH_BONUS_MAX, raw));
  // Clean $10 steps, and the floor re-applied after rounding so it can never
  // round DOWN through the minimum.
  return Math.max(AD_CASH_BONUS_MIN, Math.round(clamped / 10) * 10);
};

/** Weeks until the bonus is claimable again — 0 when it is ready now. */
export const weeksUntilAdCashBonus = (state: GameState): number => {
  const ws = state.weeksLived ?? 0;
  const last = state.settings?.lastAdCashBonusWeek;
  if (typeof last !== 'number' || !isFinite(last)) return 0; // never claimed
  return Math.max(0, AD_CASH_BONUS_COOLDOWN_WEEKS - (ws - last));
};

/** True when the sponsored bonus can be claimed right now. */
export const canClaimAdCashBonus = (state: GameState): boolean =>
  weeksUntilAdCashBonus(state) === 0;

/**
 * Claim the weekly sponsored bonus.
 *
 * This was an UNGATED faucet: the only ad reward in the game that paid CASH,
 * with no cooldown, no cap and no claim marker, so it could be watched
 * repeatedly for 2% of the balance each time (2026-07-28 audit econ-4). It now
 * mirrors `watchAdForFollowerBoost`: one claim per in-game week, keyed on
 * `weeksLived`, with the cooldown re-checked INSIDE the updater so two taps in
 * one React batch cannot both pay out.
 *
 * The marker lives on `settings` as an optional field with an undefined default
 * — the sanctioned no-migration pattern — and is game time, never wall clock.
 */
export const claimAdCashBonus = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): { success: boolean; message: string; amount: number } => {
  if (!canClaimAdCashBonus(gameState)) {
    return { success: false, message: 'You have already taken this week\'s bonus.', amount: 0 };
  }
  const amount = getAdCashBonusAmount(gameState);

  let granted = 0;
  setGameState((prev) => {
    // Atomic gate: both taps in a batch read the same stale snapshot above, so
    // this re-check against `prev` is the only thing that stops a double payout.
    if (!canClaimAdCashBonus(prev)) return prev;
    const freshAmount = getAdCashBonusAmount(prev);
    const credit = applyMoneyDelta(prev, freshAmount, 'Bank sponsored bonus');
    if (!credit) return prev;
    granted = freshAmount;
    return {
      ...prev,
      ...credit,
      settings: { ...prev.settings, lastAdCashBonusWeek: prev.weeksLived ?? 0 },
    };
  });

  return granted > 0
    ? { success: true, message: `The bank credited your account.`, amount: granted }
    : { success: false, message: 'Bonus unavailable right now.', amount: 0 };
};
