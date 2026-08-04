/**
 * Valid `Crypto`, `BankAccount` and `Loan` rows, for tests that need one of
 * them to exist on the state.
 *
 * Both existed only as inline literals, and both had drifted: the crypto
 * literals carried `{ id, symbol, owned, price }` and omitted the required
 * `name`, `change` and `changePercent`; the bank-account literals omitted
 * `openedWeek`. A trailing `as GameState` on the surrounding spread was what
 * let them through — the cast is applied to the WHOLE state object, so it
 * silences a shape error in any field, not just the one the author was
 * thinking about. That is what makes `as GameState` worth removing even where
 * the missing fields turn out not to matter.
 *
 * Here they do not: `netWorth` reads only `owned`/`price` from a coin, and
 * `nonMirrorDeposits` reads only `id`/`balance` from an account. So this is
 * hygiene rather than a shipped bug.
 *
 * The one thing that WAS being lost: `type` widened to `string`. `BankAccount`
 * declares it as the `BankAccountType` union, so a typo'd tier ('savingz')
 * would have type-checked inside the cast and then quietly failed to match any
 * balance rule that switches on it.
 */
import type { BankAccount, Crypto, Loan } from '@/contexts/game/types';

export function makeCrypto(overrides: Partial<Crypto> = {}): Crypto {
  return {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 30_000,
    change: 0,
    changePercent: 0,
    owned: 0,
    ...overrides,
  };
}

export function makeBankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'acct_1',
    type: 'savings',
    name: 'Savings',
    balance: 0,
    baseAPR: 0,
    openedWeek: 0,
    ...overrides,
  };
}

/**
 * A valid `Loan`. Same story: the inline literals carried five of the twelve
 * required fields, and the surrounding `as GameState` absorbed the other seven
 * (`termWeeks`, `weeklyPayment`, `startWeek`, `autoPay`, `type`,
 * `weeksRemaining`, `interestRate`).
 *
 * `remaining` defaults to `principal` so the common case — "a loan of X" —
 * reads as one number rather than two that must be kept in step. netWorth
 * subtracts `remaining ?? principal`, so a fixture that set only one of them
 * was relying on that fallback whether or not its author knew.
 */
export function makeLoan(overrides: Partial<Loan> = {}): Loan {
  const principal = overrides.principal ?? 1_000;
  return {
    id: 'loan_1',
    name: 'Loan',
    principal,
    remaining: principal,
    rateAPR: 0.1,
    termWeeks: 52,
    weeklyPayment: Math.round(principal / 52),
    startWeek: 0,
    autoPay: false,
    type: 'personal',
    weeksRemaining: 52,
    interestRate: 0.1,
    ...overrides,
  };
}
