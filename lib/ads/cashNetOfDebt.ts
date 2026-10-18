/**
 * Cash minus what the player owes: the "cash" side of the net-worth-scaled ad
 * cash rewards (the bank's sponsored bonus and the reward orb).
 *
 * Both pay a share of `max(netWorth, cash)`, the cash term there so a
 * cash-rich, mortgage-heavy player is not pushed to the floor by a net worth
 * that subtracts the mortgage. But the cash term counted BORROWED cash too:
 * take a loan, watch both ads, prepay the loan the same week (no fee, no
 * interest before the tick) and the rewards paid ~3.5% of the loan, every week
 * (exploit sweep, 2026-10-19). Net worth already subtracts loans, card balances
 * and arrears, so subtracting the same debts here makes borrowing neutral and
 * leaves every debt-free player exactly where they were.
 */
import type { GameState } from '@/contexts/game/types';
import { totalCreditCardDebt } from '@/lib/banking/operations';

const finite = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? n : 0);

export function cashNetOfDebt(state: GameState): number {
  const cash = Math.max(0, finite(state.stats?.money));
  const loans = (state.loans ?? []).reduce(
    (sum, loan) => sum + Math.max(0, finite(loan?.remaining ?? loan?.principal)),
    0,
  );
  let cards = 0;
  try {
    cards = Array.isArray(state.banking?.creditCards) ? Math.max(0, finite(totalCreditCardDebt(state.banking))) : 0;
  } catch {
    cards = 0;
  }
  const overdue = Math.max(0, finite(state.overdueBalance));
  return Math.max(0, cash - loans - cards - overdue);
}
