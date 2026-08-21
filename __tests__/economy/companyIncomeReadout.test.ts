/**
 * Company income: what the readouts show === what the paycheck credits.
 *
 * A support report from a player at $26M net worth: "I make 360k but only
 * receive 60k, and that is not even for my lifestyle." Nothing was stealing the
 * money — three separate drags were being applied at payout and NONE of them
 * appeared anywhere on screen:
 *
 *   1. the portfolio-size management penalty (up to −30% for 11+ companies),
 *   2. `PER_SOURCE_CAPS.companies`, a hard $200K/wk ceiling on TOTAL company
 *      income, and
 *   3. the net-worth soft cap, which above $10M multiplies the whole passive
 *      total by `0.9^floor((netWorth − 10M) / 10M)`.
 *
 * Meanwhile the Hustle dashboard, both bank apps and the loan DTI gates each
 * summed the raw stored `company.weeklyIncome`, which is the base BEFORE even
 * the per-company bonuses — so the advertised figure was high and the paid one
 * was low for four independent reasons at once.
 *
 * This suite pins the property that fixes it: one function owns the payout
 * chain, and every readout derives from it.
 */

import type { Company, GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  COMPANY_INCOME_CAP,
  calcCompanyWeeklyIncome,
  calcWeeklyPassiveIncome,
  companyCountEfficiency,
  companyIncomePaidWeekly,
  companyWeeklyIncomeFor,
  managementLevels,
  passiveIncomeEfficiency,
} from '@/lib/economy/passiveIncome';
import { netWorth } from '@/lib/progress/achievements';

function company(id: string, weeklyIncome: number): Company {
  return {
    id,
    name: `Co ${id}`,
    type: 'factory',
    weeklyIncome,
    baseWeeklyIncome: weeklyIncome,
    upgrades: [],
    employees: 0,
    workerSalary: 500,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
  };
}

/** `money` is the only asset, so net worth is predictable. */
function stateWith(companies: Company[], money: number): GameState {
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, money },
    companies,
    realEstate: [],
    stocks: base.stocks,
  };
}

describe('portfolio-size efficiency', () => {
  it('matches the documented tiers', () => {
    const tiers: [number, number][] = [
      [0, 1], [1, 1], [3, 1], [4, 0.9], [6, 0.9], [7, 0.8], [10, 0.8], [11, 0.7], [40, 0.7],
    ];
    for (const [count, expected] of tiers) {
      expect(`${count}:${companyCountEfficiency(count)}`).toBe(`${count}:${expected}`);
    }
  });

  it('treats a missing or corrupt count as an empty portfolio', () => {
    for (const bad of [undefined, null, NaN, Infinity, -4]) {
      expect(companyCountEfficiency(bad as number)).toBe(1);
    }
  });
});

describe('the summary reconciles', () => {
  it('names every step between what companies earn and what is paid', () => {
    // 12 companies at $30k = $360k stored — the reporter's number.
    const companies = Array.from({ length: 12 }, (_, i) => company(`c${i}`, 30_000));
    const summary = calcCompanyWeeklyIncome(stateWith(companies, 26_000_000));

    expect(summary.stored).toBe(360_000);
    expect(summary.efficiency).toBe(0.7); // 11+ companies
    expect(summary.afterEfficiency).toBe(252_000);
    expect(summary.cap).toBe(COMPANY_INCOME_CAP);
    expect(summary.paid).toBe(COMPANY_INCOME_CAP); // ceilinged
    expect(summary.capped).toBe(true);
    expect(summary.lost).toBe(summary.afterBonuses - summary.paid);
  });

  it('reports no drag at all for a small portfolio and a modest net worth', () => {
    const summary = calcCompanyWeeklyIncome(stateWith([company('a', 5_000)], 100_000));
    expect(summary.efficiency).toBe(1);
    expect(summary.paid).toBe(summary.afterBonuses);
    expect(summary.lost).toBe(0);
    expect(summary.capped).toBe(false);
  });

  it('survives a missing / corrupt companies list', () => {
    for (const bad of [undefined, null, 'nope']) {
      // Through the factory (Hard Rule #3) — only the ONE field under test is
      // widened, rather than casting a hand-built object to GameState and
      // losing the compile-time check on every other field.
      const state = createTestGameState({ companies: bad as never });
      const summary = calcCompanyWeeklyIncome(state);
      expect(`${summary.paid}:${summary.lost}:${summary.efficiency}`).toBe('0:0:1');
    }
  });
});

describe('the readouts equal the paycheck', () => {
  it('`paid` is exactly what lands in the passive-income breakdown', () => {
    for (const [count, per, money] of [[12, 30_000, 26_000_000], [2, 4_000, 50_000], [5, 50_000, 12_000_000]] as const) {
      const state = stateWith(Array.from({ length: count }, (_, i) => company(`c${i}`, per)), money);
      const label = `${count} companies at $${per}`;
      const breakdownCompanies = calcWeeklyPassiveIncome(state).breakdown.companies;
      expect(`${label}: ${breakdownCompanies}`).toBe(`${label}: ${calcCompanyWeeklyIncome(state).paid}`);
    }
  });

  it('`companyIncomePaidWeekly` folds in the net-worth soft cap too', () => {
    const state = stateWith([company('a', 40_000)], 26_000_000);
    const efficiency = passiveIncomeEfficiency(netWorth(state), managementLevels(state.companies));
    expect(efficiency).toBeLessThan(1);
    expect(companyIncomePaidWeekly(state)).toBe(
      Math.round(calcCompanyWeeklyIncome(state).paid * efficiency),
    );
  });

  it('the per-company figure the tiles show sums to the pre-penalty total', () => {
    const companies = [company('a', 10_000), company('b', 7_500)];
    const state = stateWith(companies, 100_000);
    const summed = companies.reduce((s, c) => s + companyWeeklyIncomeFor(state, c, 1), 0);
    expect(summed).toBe(calcCompanyWeeklyIncome(state).afterBonuses);
  });
});

describe('the passive-income result closes its own arithmetic', () => {
  it('gross + skillBonus - overhead === total', () => {
    for (const money of [50_000, 9_999_999, 26_000_000, 150_000_000]) {
      const state = stateWith([company('a', 40_000)], money);
      const r = calcWeeklyPassiveIncome(state);
      expect(`${money}:${r.gross + r.skillBonus - r.overhead}`).toBe(`${money}:${r.total}`);
    }
  });

  it('reports the efficiency actually applied, and no overhead below the threshold', () => {
    const poor = calcWeeklyPassiveIncome(stateWith([company('a', 40_000)], 1_000_000));
    expect(`${poor.efficiency}:${poor.overhead}`).toBe('1:0');

    const rich = calcWeeklyPassiveIncome(stateWith([company('a', 40_000)], 150_000_000));
    expect(rich.efficiency).toBeLessThan(1);
    expect(rich.overhead).toBeGreaterThan(0);
    expect(rich.total).toBe(Math.round(rich.gross * rich.efficiency));
  });
});
