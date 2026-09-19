import { createTestGameState } from '../helpers/createTestGameState';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import type { GameState } from '@/contexts/game/types';

/**
 * MP08: the wallet forecast must show the old arrears the tick settles FIRST.
 *
 * `applyArrears` pays standing debt off the top of `cash + income` before this
 * week's bills. `calcWeeklyExpenses` ignored it, so a player carrying arrears
 * saw a Cash Flow that pretended the debt was not about to be collected.
 *
 * Gated behind `includeArrears` so the financial-independence/economic callers
 * keep their existing totals; the wallet forecast opts in.
 */
const base = () => createTestGameState();
const withMoney = (money: number, overdue: number): GameState => {
  const b = base();
  return { ...b, overdueBalance: overdue, stats: { ...b.stats, money } };
};

describe('old arrears in the wallet forecast', () => {
  it('is absent by default, so economic callers are unchanged', () => {
    const state = withMoney(1000, 500);
    expect(calcWeeklyExpenses(state).breakdown.arrears).toBe(0);
    expect(calcWeeklyExpenses(state).total).toBe(calcWeeklyExpenses(base()).total);
  });

  it('is settled first and capped at cash plus income', () => {
    // Cash covers the whole old debt.
    expect(calcWeeklyExpenses(withMoney(1000, 500), 0, { includeArrears: true }).breakdown.arrears).toBe(500);
    // Cash and income together cannot.
    expect(calcWeeklyExpenses(withMoney(100, 500), 50, { includeArrears: true }).breakdown.arrears).toBe(150);
    // Nothing overdue means no line.
    expect(calcWeeklyExpenses(withMoney(1000, 0), 0, { includeArrears: true }).breakdown.arrears).toBe(0);
  });

  it('reaches the total, not just the breakdown', () => {
    const withDebt = calcWeeklyExpenses(withMoney(1000, 500), 0, { includeArrears: true });
    const withoutDebt = calcWeeklyExpenses(withMoney(1000, 0), 0, { includeArrears: true });
    expect(withDebt.total - withoutDebt.total).toBe(500);
  });
});
