/**
 * LATE-3: what an heir inherits.
 *
 * `computeInheritance` summed cash + bank + property price + 5x company income
 * and never read stocks, crypto, opened bank accounts, vehicles, luxury items
 * or card debt - so a parent holding $50M in stocks left their heir almost
 * nothing while the death screen quoted the canonical net worth. It also paid
 * family businesses twice: as cash here AND as the live company the heir keeps.
 * The estate is now the canonical `netWorth` of what does not pass in kind.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { computeInheritance, estateValue } from '@/lib/legacy/inheritance';
import { continueAsChild } from '@/lib/prestige/prestigeExecution';
import { calculateChildInheritance } from '@/lib/prestige/childStats';
import { netWorth } from '@/lib/progress/achievements';

const STOCK_VALUE = 5_000_000;

function parent(over: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived: 2_600,
    lifeStartWeek: 0,
    stats: { ...base.stats, money: 0 },
    bankSavings: 0,
    loans: [],
    companies: [],
    realEstate: [],
    family: {
      ...base.family,
      children: [
        { id: 'kid1', name: 'Sam', type: 'child', relationshipScore: 80, personality: 'curious', age: 20, datesCount: 0 } as never,
      ],
    },
    ...over,
  };
}

function withStocks(state: GameState): GameState {
  return {
    ...state,
    stocks: {
      ...(state.stocks ?? { watchlist: [] }),
      holdings: [{ symbol: 'IDX', shares: 50_000, averagePrice: 50, currentPrice: STOCK_VALUE / 50_000 }],
      watchlist: state.stocks?.watchlist ?? [],
    },
  };
}

describe('the estate an heir inherits from (LATE-3)', () => {
  it('counts stock holdings, at the canonical net-worth figure', () => {
    const investor = withStocks(parent());
    expect(estateValue(investor)).toBe(netWorth(investor));
    expect(computeInheritance(investor).totalNetWorth).toBe(netWorth(investor));
    expect(estateValue(investor) - estateValue(parent())).toBe(STOCK_VALUE);
  });

  it('pays the heir their share of a stock-only fortune', () => {
    const plain = continueAsChild(parent(), 'kid1');
    const investor = continueAsChild(withStocks(parent()), 'kid1');
    const delta = investor.stats.money - plain.stats.money;
    const expected =
      calculateChildInheritance(estateValue(withStocks(parent()))) - calculateChildInheritance(estateValue(parent()));
    expect(delta).toBe(expected);
    expect(delta).toBeGreaterThanOrEqual(STOCK_VALUE * 0.1);
  });

  it('does not pay a carried family business twice', () => {
    const company = { id: 'co1', name: 'Acme', weeklyIncome: 10_000 } as never;
    const withBusiness = parent({
      companies: [company],
      familyBusinesses: [{ companyId: 'co1', foundedGeneration: 1, generationsHeld: 1, brandValue: 0, reputation: 50 }],
    });
    const withPlainCompany = parent({ companies: [company] });

    // The family business passes down as a live company, so it is not cash too.
    expect(estateValue(withBusiness)).toBe(estateValue(parent()));
    // An ordinary company is sold into the estate.
    expect(estateValue(withPlainCompany)).toBeGreaterThan(estateValue(parent()));
    expect(computeInheritance(withBusiness).familyBusinessIds).toEqual(['co1']);
    expect(computeInheritance(withPlainCompany).familyBusinessIds).toEqual([]);
  });
});
