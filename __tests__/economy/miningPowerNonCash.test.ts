import { createTestGameState } from '../helpers/createTestGameState';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { minerFleetWeeklyPowerCost } from '@/lib/economy/minerPower';
import type { GameState } from '@/contexts/game/types';

/**
 * MP08: the wallet forecast must not bill cash for power the tick pays in crypto.
 *
 * `applyMiningCryptos` deducts warehouse electricity from the crypto it mints
 * (`result.totalPowerCost` against `result.cryptoEarned`); no cash ever leaves
 * `stats.money` for it. `calcWeeklyExpenses` nevertheless adds it to the CASH
 * total, so a miner's Cash Flow understates real cash by the whole power bill.
 *
 * The economic cost still belongs in the breakdown (financial-independence and
 * net-worth views want it), so the default total keeps it and the wallet
 * forecast opts out.
 */
const fleet: Record<string, number> = { basic: 10 };
const withFleet = (): GameState => ({
  ...createTestGameState(),
  warehouse: { level: 1, miners: fleet },
});

describe('warehouse mining power is economic cost, not a cash debit', () => {
  it('keeps the economic cost in the default total and names it in the breakdown', () => {
    const expected = minerFleetWeeklyPowerCost(fleet);
    expect(expected).toBeGreaterThan(0); // guards the assertion below

    const { total, breakdown } = calcWeeklyExpenses(withFleet());
    expect(breakdown.miningPower).toBe(expected);
    expect(total).toBe(calcWeeklyExpenses(createTestGameState()).total + expected);
  });

  it('excludes it from the CASH total while still reporting the line', () => {
    const expected = minerFleetWeeklyPowerCost(fleet);
    const { total, breakdown } = calcWeeklyExpenses(withFleet(), undefined, {
      excludeMiningPower: true,
    });

    // The line survives for the views that want the economic cost...
    expect(breakdown.miningPower).toBe(expected);
    // ...but the cash total matches a player with no miners at all.
    expect(total).toBe(calcWeeklyExpenses(createTestGameState()).total);
  });
});
