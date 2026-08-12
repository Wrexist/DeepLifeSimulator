/**
 * The Net Worth modal's itemised rows must add up to the headline it prints.
 *
 * This is UX-3's other half, and it kept getting lost. `NetWorthBreakdownModal`
 * carried two lists — the assets it valued for the big number, and a
 * hand-written list of rows underneath — and every term added to the first was
 * forgotten in the second. Stocks and luxury reached the total but never got a
 * row; bank accounts and crypto repeated it. The symptom is quiet: the headline
 * stays correct while the percentages beneath it stop reaching 100%, so the
 * modal under-explains the exact figure it exists to explain.
 *
 * `buildNetWorthItemisation` now produces both from one valued list, and this
 * file is what stops the two halves separating again. It is a plain node test
 * on purpose: the render harness (`__tests__/render/helpers`) cannot seed a
 * portfolio, so a mount smoke could never have caught any of the four misses.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { buildNetWorthItemisation, NET_WORTH_GROUPS } from '@/utils/netWorthItemisation';
import { LUXURY_CATALOG } from '@/lib/luxury';
import type { GameState } from '@/contexts/game/types';

/** A player who holds something in EVERY group the modal can render. */
function richState(): GameState {
  const luxuryId = LUXURY_CATALOG[0].id;
  return createTestGameState({
    stats: { money: 12_500 },
    bankSavings: 40_000,
    banking: {
      accounts: [
        // The two mirrors — these must NOT produce rows; they duplicate the
        // cash and savings above.
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: 12_500, baseAPR: 0, openedWeek: 0 },
        { id: 'savings-default', type: 'savings', name: 'Savings', balance: 40_000, baseAPR: 0.01, openedWeek: 0 },
        { id: 'hy-1', type: 'highYield', name: 'High Yield', balance: 75_000, baseAPR: 0.04, openedWeek: 4 },
      ],
    },
    cryptos: [
      { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 60_000, owned: 0.5, history: [], change24h: 0 },
    ],
    // D-5: laundered proceeds are spendable BTC and must appear as a row, not
    // only in the total. Held here so the sum invariant covers them too.
    darkWeb: { cleanBtc: 0.25, dirtyBtc: 3 },
    stocks: {
      holdings: [{ symbol: 'ACME', shares: 100, currentPrice: 42, avgCost: 30 }],
    },
    luxuryItems: [luxuryId],
    items: [{ id: 'laptop', name: 'Laptop', price: 1_200, owned: true, category: 'tech', description: '' }],
    companies: [
      { id: 'co-1', name: 'Acme Co', weeklyIncome: 2_000, miners: { basic: 2 } },
    ],
    realEstate: [
      { id: 'house-1', name: 'Starter Home', price: 200_000, currentValue: 260_000, owned: true },
    ],
    vehicles: [
      { id: 'car-1', name: 'Sedan', price: 30_000, condition: 80, mileage: 20_000 },
    ],
    loans: [{ id: 'loan-1', remaining: 15_000 }],
  } as unknown as Partial<GameState>);
}

describe('every value in the headline is visible in a row', () => {
  const { breakdown, rows } = buildNetWorthItemisation(richState());

  it('the fixture actually holds something in every group (guards everything below)', () => {
    // Without this, a fixture that silently stopped populating (a renamed field,
    // a changed shape) would leave `rows` short and the sum assertions would
    // pass on almost nothing — the vacuous-pass failure mode these tests exist
    // to prevent.
    expect(rows.map((r) => r.group).sort()).toEqual([...NET_WORTH_GROUPS].sort());
  });

  it('the rows sum to the total assets the header prints', () => {
    const rowSum = rows.reduce((sum, r) => sum + r.value, 0);
    // Each row is rounded for display, so the sum can differ from the rounded
    // total by at most half a unit per row. Anything beyond that is a missing
    // or double-counted term, not rounding.
    expect(Math.abs(rowSum - breakdown.totalAssets)).toBeLessThanOrEqual(rows.length);
  });

  it('the sub-items sum to their own row', () => {
    for (const row of rows) {
      const itemSum = row.items.reduce((sum, i) => sum + i.value, 0);
      expect(`${row.group}: ${Math.abs(itemSum - row.value) <= row.items.length}`).toBe(
        `${row.group}: true`,
      );
    }
  });

  it('the percentages the modal computes reach 100%', () => {
    // This is what the player actually sees, and the exact number that used to
    // fall short: `(row.value / totalAssets) * 100` per row.
    const pct = rows.reduce((sum, r) => sum + (r.value / breakdown.totalAssets) * 100, 0);
    expect(pct).toBeGreaterThan(99.5);
    expect(pct).toBeLessThan(100.5);
  });
});

describe('the mirror accounts are not counted twice', () => {
  it('the crypto row itemises the wallet and the laundered pocket separately', () => {
    // Same asset, two places. A player looking for their laundering proceeds
    // should find them named rather than silently merged into the coin above.
    const { rows } = buildNetWorthItemisation(richState());
    const crypto = rows.find((r) => r.group === 'crypto');
    expect(crypto?.items.map((i) => i.name)).toEqual(['Bitcoin', 'Bitcoin (laundered)']);
  });

  it('dirty BTC is not itemised — it is not counted anywhere', () => {
    const { rows } = buildNetWorthItemisation(richState());
    const names = rows.flatMap((r) => r.items.map((i) => i.name));
    expect(names.filter((n) => /dirty/i.test(n))).toEqual([]);
  });

  it('"Your Accounts" excludes checking-default and savings-default', () => {
    const { rows } = buildNetWorthItemisation(richState());
    const accounts = rows.find((r) => r.group === 'accounts');
    expect(accounts?.items.map((i) => i.name)).toEqual(['High Yield']);
  });

  it('removing the self-opened account removes the row, not the cash', () => {
    const state = richState();
    const bare: GameState = {
      ...state,
      banking: {
        ...state.banking!,
        accounts: (state.banking?.accounts ?? []).filter((a) => a.id !== 'hy-1'),
      },
    };
    const { rows, breakdown } = buildNetWorthItemisation(bare);
    expect(rows.some((r) => r.group === 'accounts')).toBe(false);
    // Cash and savings survive — they never came from the accounts list.
    expect(rows.some((r) => r.group === 'cash')).toBe(true);
    expect(rows.some((r) => r.group === 'savings')).toBe(true);
    // And the total drops by roughly the removed balance, not by more.
    const full = buildNetWorthItemisation(richState()).breakdown.totalAssets;
    expect(full - breakdown.totalAssets).toBeGreaterThan(70_000);
    expect(full - breakdown.totalAssets).toBeLessThan(76_000);
  });
});

describe('debt still counts against the headline', () => {
  it('net worth is total assets minus the outstanding loans', () => {
    const { breakdown } = buildNetWorthItemisation(richState());
    expect(breakdown.totalLiabilities).toBe(15_000);
    expect(breakdown.netWorth).toBe(breakdown.totalAssets - breakdown.totalLiabilities);
  });
});

describe('an empty life produces an empty list, not a broken one', () => {
  it('no holdings → no rows, and no division by zero in the percentages', () => {
    const broke = createTestGameState({ stats: { money: 0 }, bankSavings: 0 } as unknown as Partial<GameState>);
    const { rows, breakdown } = buildNetWorthItemisation(broke);
    // Assert the TITLE. The loop below alone proved nothing: an empty `rows`
    // never enters it, and a non-empty `rows` passes as long as the values are
    // positive — so the test claimed "no rows" while checking neither case.
    // Verified empty against the real `createTestGameState`, which seeds no
    // owned items or vehicles.
    expect(rows).toEqual([]);
    for (const row of rows) {
      expect(row.value).toBeGreaterThan(0);
    }
    expect(breakdown.totalAssets).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(breakdown.netWorth)).toBe(true);
  });
});
