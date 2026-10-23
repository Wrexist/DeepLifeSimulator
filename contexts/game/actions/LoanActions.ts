/**
 * Loan actions — applications, payments, prepayment, refinance.
 *
 * Loans live at gameState.loans[] (legacy field, kept). The new banking slice
 * computes credit score from the same data. Payments debit from a chosen banking
 * account; if that fails, the loan accrues a late-payment count.
 */
import React from 'react';
import { GameState, Loan } from '../types';
import { logger } from '@/utils/logger';
import { initialGameState } from '../initialState';
import { isPlayerBlocked } from './_guards';
import { applyMoneyDelta } from './MoneyActions';
import {
  quoteLoan,
  MIRRORED_ACCOUNT_IDS,
} from '@/lib/banking/operations';
import {
  calculatePeriodicPayment,
  creditScoreAPRAdjustment,
  exceedsDTI,
  MIN_SCORE_BY_LOAN_TYPE,
} from '@/lib/banking/amortization';
import { effectiveLoanAPR } from '@/lib/banking/rateEnvironment';

const log = logger.scope('LoanActions');

function ensureBanking(state: GameState): GameState {
  if (state.banking) return state;
  return { ...state, banking: initialGameState.banking };
}

export interface LoanQuote {
  rejected: boolean;
  reason?: string;
  offeredAPR?: number;
  weeklyPayment?: number;
  totalRepaid?: number;
}

/**
 * The player's politics-perk APR reduction, as a DECIMAL APR delta.
 *
 * The doc comment here used to claim it returned a decimal; it returned the raw
 * percent. `PoliticalPerk.effects.loanInterestReduction` is documented at
 * `lib/politics/perks.ts:13` as "Percentage reduction (0-100)" and carries the
 * values 2, 5, 8, 12, 15, 20 — while `quoteLoan` consumes it as a decimal APR
 * (`Math.min(0.2, aprReduction)`). So the SMALLEST perk, a Council Member's 2,
 * clamped to 0.2 = twenty APR points and floored every loan type at the 0.025
 * floor from the player's first elected office onward.
 *
 * The sibling fields on the very same effects object are converted correctly —
 * `realEstateTaxBreak / 100` and `businessIncomeBonus / 100` in
 * `lib/economy/passiveIncome.ts` — so this one was simply missed.
 *
 * That also broke the documented anti-arbitrage contract in
 * `lib/banking/rateEnvironment.ts:12-21`: deposits are hard-capped at
 * SAVINGS_APR_HARD_CAP (5.5%) precisely so the cheapest loan stays above them,
 * and a 2.5% loan against a 5.5% CD is a risk-free carry. Hence the second
 * clamp below. 2026-07-31 audit round 3, R3-M2.
 */
export function politicsAprReduction(state: GameState): number {
  try {
    const careerLevel = state.politics?.careerLevel ?? 0;
    if (!careerLevel) return 0;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCombinedPerkEffects } = require('@/lib/politics/perks');
    const effects = getCombinedPerkEffects(careerLevel);
    const percent = typeof effects.loanInterestReduction === 'number'
      && Number.isFinite(effects.loanInterestReduction)
      ? Math.max(0, effects.loanInterestReduction)
      : 0;
    return percent / 100;
  } catch {
    return 0;
  }
}

/**
 * Floor for a politics-discounted loan APR.
 *
 * Holding office must not beat the paid Private Banking product, and must never
 * cross the deposit hard cap — otherwise borrow-low/save-high pays. Matches
 * PRIVATE_BANKING_APR_CAP; the 5.5% deposit ceiling sits safely below it.
 */
export const POLITICS_LOAN_APR_FLOOR = 0.06;

/**
 * Private Banking IAP delivers "VIP low-APR loans" — caps every loan's offered
 * rate (and refinances down to it). Returns undefined when not owned so pricing
 * falls through to the normal credit-score + politics formula.
 *
 * BALANCE: this cap MUST stay above the best self-opened deposit APR
 * (CD = 5.5%, HYSA = 4.5%) or it opens a risk-free borrow-low/save-high
 * arbitrage. Set to 6% — still a real discount vs the ~8% base loan rate, but
 * above every deposit rate so parking a loan in a CD loses money.
 */
export const PRIVATE_BANKING_APR_CAP = 0.06;
export function privateBankingAprCap(state: GameState): number | undefined {
  return state.settings?.privateBanking ? PRIVATE_BANKING_APR_CAP : undefined;
}

/**
 * Stamp `progress.hasBeenInDebt` when an updater originates a loan.
 *
 * R4 completion of GL-5. `acceptLoan` set the flag inline and was described as
 * "the ONLY writer" — which was the problem, not the fix. Three other modules
 * originate loans and none of them stamped it:
 *
 *   - `EducationActions.enrollInProgram` (student loan)
 *   - `VehicleActions.purchaseVehicleWithAutoLoan` (auto loan)
 *   - `RealEstateActions.purchaseProperty` (mortgage)
 *
 * So a player who financed a car or a house, paid it off and never once used
 * the generic Loans screen had `hasBeenInDebt === false` forever. That is the
 * gate on the "Debt Free" achievement, and on the R3-P11 "Clean Slate" prestige
 * bonus (2,000 pts) — both of which describe exactly what that player did.
 *
 * Spread into the updater's return object: `...debtProgress(prev, borrowed)`.
 * Returns the previous `progress` untouched when nothing was borrowed, so a
 * cash purchase is a no-op.
 */
export function debtProgress(prev: GameState, borrowed: boolean): Pick<GameState, 'progress'> {
  if (!borrowed) return { progress: prev.progress };
  return { progress: { ...(prev.progress ?? {}), hasBeenInDebt: true } };
}

/**
 * Most loans a player may carry at once (M-3). The DTI gate alone could be
 * stacked past intent (missed-payment penalties inflate a loan's `remaining`
 * but not its `weeklyPayment`, so quoteLoan understates debt service).
 */
export const MAX_ACTIVE_LOANS = 6;

/** Loans still owing money - the count `MAX_ACTIVE_LOANS` limits. */
export function activeLoanCount(state: Pick<GameState, 'loans'>): number {
  return (state.loans ?? []).filter(
    (l) => (typeof l?.remaining === 'number' ? l.remaining : 0) > 0
  ).length;
}

/**
 * Synchronous quote for the UI (read-only, doesn't mutate state).
 * Mirrors lib/banking/operations.quoteLoan but flattens the result for component use.
 */
export function getLoanQuote(
  state: GameState,
  request: {
    principal: number;
    termWeeks: number;
    type: Loan['type'];
    weeklyIncome: number;
  }
): LoanQuote {
  const banking = state.banking ?? initialGameState.banking;
  if (!banking) {
    return { rejected: true, reason: 'Banking not initialized' };
  }
  // The same cap `acceptLoan` enforces (APP2-2). The quote used to skip it, so
  // a seventh loan showed an approved offer, Accept closed the sheet, and
  // `acceptLoan` refused it with only a log line - no loan, no message.
  if (activeLoanCount(state) >= MAX_ACTIVE_LOANS) {
    return { rejected: true, reason: `You already have ${MAX_ACTIVE_LOANS} loans open. Pay one off first.` };
  }
  const result = quoteLoan(banking, state.loans ?? [], {
    ...request,
    aprReduction: politicsAprReduction(state),
    aprFloor: politicsAprReduction(state) > 0 ? POLITICS_LOAN_APR_FLOOR : undefined,
    aprCap: privateBankingAprCap(state),
    loanDelta: banking.rateEnvironment?.loanDelta,
  });
  if (result.rejected) {
    return { rejected: true, reason: result.reason };
  }
  return {
    rejected: false,
    offeredAPR: result.offeredAPR,
    weeklyPayment: result.weeklyPayment,
    totalRepaid: result.totalRepaid,
  };
}

/**
 * Apply for and accept a loan. Adds the principal to the chosen deposit account
 * (typically checking), and creates a Loan with weeklyPayment + autoPay enabled.
 */
export const acceptLoan = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  spec: {
    principal: number;
    termWeeks: number;
    type: Loan['type'];
    name: string;
    weeklyIncome: number;
    /** Account to receive the loan principal. */
    depositAccountId: string;
    autoPay?: boolean;
  }
) => {
  setGameState((prev) => {
    // P1-3: dead players can't take out loans.
    if (isPlayerBlocked(prev)) return prev;
    const state = ensureBanking(prev);
    if (!state.banking) return prev;

    // M-3: hard cap on concurrent active loans (see MAX_ACTIVE_LOANS).
    // getLoanQuote applies the same test, so the sheet says so up front.
    if (activeLoanCount(state) >= MAX_ACTIVE_LOANS) {
      log.info(`Loan rejected: already at the ${MAX_ACTIVE_LOANS}-loan limit`);
      return prev;
    }

    const quote = quoteLoan(state.banking, state.loans ?? [], {
      principal: spec.principal,
      termWeeks: spec.termWeeks,
      type: spec.type,
      weeklyIncome: spec.weeklyIncome,
      aprReduction: politicsAprReduction(state),
      aprFloor: politicsAprReduction(state) > 0 ? POLITICS_LOAN_APR_FLOOR : undefined,
      aprCap: privateBankingAprCap(state),
      loanDelta: state.banking.rateEnvironment?.loanDelta,
    });
    if (quote.rejected) {
      log.info(`Loan rejected: ${quote.reason}`);
      return prev;
    }

    const depositIdx = state.banking.accounts.findIndex((a) => a.id === spec.depositAccountId);
    if (depositIdx === -1) {
      log.warn(`Loan deposit failed: account ${spec.depositAccountId} not found`);
      return prev;
    }

    const newLoan: Loan = {
      id: `loan-${spec.type}-${state.weeksLived}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      name: spec.name,
      principal: spec.principal,
      remaining: spec.principal,
      rateAPR: quote.offeredAPR,
      originalAPR: quote.offeredAPR,
      termWeeks: spec.termWeeks,
      weeklyPayment: quote.weeklyPayment,
      startWeek: state.weeksLived,
      autoPay: spec.autoPay ?? true,
      type: spec.type,
      weeksRemaining: spec.termWeeks,
      interestRate: quote.offeredAPR,
      onTimePayments: 0,
      latePayments: 0,
    };

    // R10-1: do NOT also credit the deposit account's balance. The weekly tick's
    // `mirrorAccountsFromLegacy` only syncs `checking-default` from `stats.money`;
    // any other account (e.g. savings) keeps a balance crediting it here adds on
    // top of the `stats.money` credit below → the principal is counted twice and
    // withdrawing yields a second copy. Cash (`stats.money`) is authoritative;
    // checking-default reflects it on the next tick. `depositIdx` is still
    // validated above so a bad account id rejects the loan.
    const banking = {
      ...state.banking,
      creditScore: {
        ...state.banking.creditScore,
        inquiries: [
          ...state.banking.creditScore.inquiries,
          { weeksLived: state.weeksLived, type: spec.type === 'mortgage' ? 'mortgage' as const : 'loan' as const },
        ],
      },
    };

    // R5-B: also credit `stats.money` with the principal. The weekly tick's
    // `mirrorAccountsFromLegacy` overwrites the checking-default balance with
    // `stats.money` on every advance - without this, the loan principal would
    // vanish on the next weekly tick and the player would be left with the
    // repayment obligation and no cash.
    // Route the principal credit through applyMoneyDelta so it respects MONEY_CEILING
    // and the isFinite guard (a raw `money + principal` write could overflow to Infinity).
    const credit = applyMoneyDelta(state, spec.principal, `Loan principal: ${spec.name}`);
    if (!credit) return prev;
    return {
      ...state,
      loans: [...(state.loans ?? []), newLoan],
      banking,
      // GL-5: `progress.hasBeenInDebt` was initialised to `false` in
      // initialState and set nowhere in the repo, so the "Debt Free"
      // achievement - which requires having been in debt, then clearing it -
      // could never be met no matter how a player borrowed and repaid. It sat
      // permanently at 0%. Taking on a loan IS entering debt.
      ...debtProgress(state, true),
      ...credit,
    };
  });
};

/**
 * Prepay a chunk against a loan's principal (no penalty in this game).
 */
export const prepayLoan = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  loanId: string,
  fromAccountId: string,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking || !state.loans) return prev;
    const loanIdx = state.loans.findIndex((l) => l.id === loanId);
    if (loanIdx === -1) return prev;
    const loan = state.loans[loanIdx];
    const acctIdx = state.banking.accounts.findIndex((a) => a.id === fromAccountId);
    if (acctIdx === -1) return prev;
    const account = state.banking.accounts[acctIdx];

    // The mirrored checking account's `balance` is only re-synced from
    // stats.money on the weekly tick, so mid-week it can be stale in either
    // direction. The pay modal caps against LIVE cash - validate and clamp
    // against the same source, or a stale-low mirror silently under-pays and
    // a stale-high mirror pays with money the player no longer has.
    const fundedFromCash = MIRRORED_ACCOUNT_IDS.has(fromAccountId);
    const liveCash =
      typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    const fundingBalance = fundedFromCash ? liveCash : account.balance;

    const payAmount = Math.min(fundingBalance, amount, loan.remaining);
    if (payAmount <= 0) return prev;

    const accounts = [...state.banking.accounts];
    accounts[acctIdx] = { ...account, balance: Math.max(0, fundingBalance - payAmount) };
    const banking = { ...state.banking, accounts };

    const loans = [...state.loans];
    const remaining = loan.remaining - payAmount;
    if (remaining <= 0.01) {
      loans.splice(loanIdx, 1);
      log.info(`Loan ${loan.name} paid off via prepayment`);
    } else {
      // M-fix: do NOT re-amortize over the same term. Re-amortizing lowered the
      // weekly payment after each tiny prepay, which let players game DTI to stack
      // more loans. Keep the ORIGINAL weekly payment so the prepayment simply ends
      // the loan sooner (the extra principal is retired ahead of schedule).
      loans[loanIdx] = { ...loan, remaining };
    }

    // EXPLOIT FIX (H-1): when prepaying from the mirrored checking account, the
    // debit above only touched the account balance, which the next mirror tick
    // restored from stats.money - free debt repayment. Debit authoritative
    // stats.money so the prepayment actually costs the player.
    if (fundedFromCash) {
      const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
      return {
        ...state,
        loans,
        banking,
        stats: { ...state.stats, money: Math.max(0, currentMoney - payAmount) },
      };
    }

    return { ...state, loans, banking };
  });
};

/**
 * Refinance an existing loan into a new APR + term. Caller picks the new term.
 * The new APR comes from the borrower's current credit score and loan type.
 *
 * Priced like a NEW loan (ACT-1, 2026-10-21): the live rate environment's
 * `loanDelta` is applied, exactly as `quoteLoan` applies it, so a loan taken in
 * a recession can no longer be refinanced straight back to the base rate (and
 * a boom discount is honoured the same way). A refinance that RAISES the weekly
 * payment (a shorter term) must also pass the same DTI test a new loan does,
 * with the new payment replacing this loan's. One that lowers it never needs
 * to: it can only improve the borrower's DTI, and refusing it would trap a
 * struggling borrower in the payment they cannot meet.
 *
 * Pure: returns the SAME state reference on refusal, so the action can run it
 * on the snapshot for the message and again inside the updater for the commit.
 */
export function resolveRefinanceLoan(
  prev: GameState,
  loanId: string,
  newTermWeeks: number,
  weeklyIncome: number,
): { ok: boolean; message: string; next: GameState } {
  const refuse = (message: string) => ({ ok: false, message, next: prev });
  if (isPlayerBlocked(prev)) return refuse('You cannot refinance right now.');
  const state = ensureBanking(prev);
  if (!state.banking || !state.loans) return refuse('Loan not found.');
  const loanIdx = state.loans.findIndex((l) => l.id === loanId);
  if (loanIdx === -1) return refuse('Loan not found.');
  const loan = state.loans[loanIdx];
  if (!(typeof loan.remaining === 'number' && isFinite(loan.remaining) && loan.remaining > 0)) {
    return refuse('This loan is already paid off.');
  }
  if (!Number.isSafeInteger(newTermWeeks) || newTermWeeks <= 0) return refuse('Invalid term.');

  if (state.banking.creditScore.score < MIN_SCORE_BY_LOAN_TYPE[loan.type]) {
    return refuse(`Need a credit score of ${MIN_SCORE_BY_LOAN_TYPE[loan.type]} to refinance a ${loan.type} loan.`);
  }

  const baseByType: Record<Loan['type'], number> = {
    personal: 0.12,
    auto: 0.08,
    business: 0.10,
    mortgage: 0.065,
  };
  const cap = privateBankingAprCap(state);
  // Same floor as a new quote. Refinance recomputes the APR inline rather
  // than through `quoteLoan`, so it needs the politics floor applied here or
  // it becomes the cheaper route to the sub-deposit-cap rate. R3-M2.
  const politicsReduction = politicsAprReduction(state);
  const floor = politicsReduction > 0 ? POLITICS_LOAN_APR_FLOOR : 0.025;
  let newAPR = Math.max(
    floor,
    baseByType[loan.type] + creditScoreAPRAdjustment(state.banking.creditScore.score) - politicsReduction
  );
  if (typeof cap === 'number') {
    newAPR = Math.min(newAPR, Math.max(floor, cap));
  }
  // The live rate environment, applied after the cap exactly as `quoteLoan`
  // applies it - otherwise refinancing was the way out of a recession premium.
  const loanDelta = state.banking.rateEnvironment?.loanDelta;
  if (typeof loanDelta === 'number' && isFinite(loanDelta) && loanDelta !== 0) {
    newAPR = effectiveLoanAPR(newAPR, { depositMult: 1, loanDelta });
  }
  const newWeekly = calculatePeriodicPayment(loan.remaining, newAPR, newTermWeeks);

  if (newWeekly > (loan.weeklyPayment ?? 0)) {
    const otherPayments = state.loans.reduce(
      (sum, l, i) => (i === loanIdx ? sum : sum + (typeof l.weeklyPayment === 'number' && isFinite(l.weeklyPayment) ? l.weeklyPayment : 0)),
      0,
    );
    if (exceedsDTI(weeklyIncome, otherPayments, newWeekly)) {
      return refuse('Debt-to-income ratio too high for a shorter term. Try the longer term.');
    }
  }

  const loans = [...state.loans];
  loans[loanIdx] = {
    ...loan,
    rateAPR: newAPR,
    interestRate: newAPR,
    termWeeks: newTermWeeks,
    weeksRemaining: newTermWeeks,
    weeklyPayment: newWeekly,
  };

  return {
    ok: true,
    message: `Refinanced at ${(newAPR * 100).toFixed(2)}% APR: $${Math.round(newWeekly).toLocaleString('en-US')}/wk for ${newTermWeeks} weeks.`,
    next: {
      ...state,
      loans,
      banking: {
        ...state.banking,
        creditScore: {
          ...state.banking.creditScore,
          inquiries: [
            ...state.banking.creditScore.inquiries,
            { weeksLived: state.weeksLived, type: loan.type === 'mortgage' ? 'mortgage' as const : 'loan' as const },
          ],
        },
      },
    },
  };
}

/**
 * Refinance a loan. Resolved once on the snapshot for the player-facing
 * message and once inside the updater against `prev` for the commit, so the
 * charge-free re-pricing stays atomic (CLAUDE.md 4.4).
 */
export const refinanceLoan = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  loanId: string,
  newTermWeeks: number,
  weeklyIncome: number,
): { success: boolean; message: string } => {
  const preview = resolveRefinanceLoan(gameState, loanId, newTermWeeks, weeklyIncome);
  if (!preview.ok) return { success: false, message: preview.message };
  setGameState((prev) => resolveRefinanceLoan(prev, loanId, newTermWeeks, weeklyIncome).next);
  log.info(`Refinanced ${loanId}: ${preview.message}`);
  return { success: true, message: preview.message };
};

