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
import { initialGameState } from '@/contexts/game/initialState';
import { buildNetWorthItemisation, NET_WORTH_GROUPS } from '@/utils/netWorthItemisation';
import { computeNetWorth } from '@/utils/netWorth';
import { netWorth as canonicalNetWorth } from '@/lib/progress/achievements';
import { LUXURY_CATALOG } from '@/lib/luxury';
import type {
  GameState,
  BankAccount,
  Crypto,
  DarkWebState,
  Item,
  Company,
  RealEstate,
  Vehicle,
  Loan,
} from '@/contexts/game/types';

/**
 * Every holding below is a COMPLETE record of its type.
 *
 * The fixture used to be one object literal behind
 * `as unknown as Partial<GameState>`, and that single cast was hiding seven
 * separate pieces of drift: a `'highYield'` account type that does not exist
 * (the real member is `'highYieldSavings'`), a `history` key on `Crypto`, an
 * `avgCost` on a stock holding, a `category` on `Item`, and partial `Company` /
 * `RealEstate` / `Vehicle` / `Loan` records missing between four and thirteen
 * required fields each.
 *
 * None of it failed, and that is the point: a fixture that sets fields the type
 * does not have is a test asserting on something the game never produces.
 * Hard Rule #3 exists for exactly this, and a cast walks straight past it.
 */
/**
 * These slices are optional on `GameState` but shipped in `initialState`.
 *
 * A throw rather than a `?? {}` fallback: substituting an empty object would
 * quietly rebuild the partial-slice problem this whole fixture rewrite removed,
 * and it would do it silently.
 */
function requireSlice<T>(slice: T | undefined, name: string): T {
  if (!slice) throw new Error(`initialGameState ships no ${name} slice - fixture cannot be built`);
  return slice;
}

const BASE_DARK_WEB = requireSlice(initialGameState.darkWeb, 'darkWeb');
const BASE_BANKING = requireSlice(initialGameState.banking, 'banking');
const BASE_STOCKS = requireSlice(initialGameState.stocks, 'stocks');

const account = (over: Partial<BankAccount> & Pick<BankAccount, 'id' | 'type' | 'name' | 'balance'>): BankAccount => ({
  baseAPR: 0,
  openedWeek: 0,
  ...over,
});

const BTC: Crypto = {
  id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 60_000, change: 0, changePercent: 0, owned: 0.5,
};

const LAUNDERED: DarkWebState = { ...BASE_DARK_WEB, cleanBtc: 0.25, dirtyBtc: 3 };

const LAPTOP: Item = { id: 'laptop', name: 'Laptop', price: 1_200, owned: true, description: '' };

const ACME: Company = {
  id: 'co-1',
  name: 'Acme Co',
  type: 'factory',
  weeklyIncome: 2_000,
  baseWeeklyIncome: 2_000,
  upgrades: [],
  employees: 0,
  workerSalary: 0,
  workerMultiplier: 1,
  marketingLevel: 0,
  miners: { basic: 2 },
  warehouseLevel: 0,
};

const HOUSE: RealEstate = {
  id: 'house-1',
  name: 'Starter Home',
  price: 200_000,
  currentValue: 260_000,
  owned: true,
  weeklyHappiness: 0,
  weeklyEnergy: 0,
  interior: [],
  upgradeLevel: 0,
};

const SEDAN: Vehicle = {
  id: 'car-1',
  name: 'Sedan',
  type: 'car',
  brand: 'Generic',
  model: 'Sedan',
  year: 2020,
  price: 30_000,
  condition: 80,
  fuelLevel: 100,
  fuelCapacity: 50,
  fuelEfficiency: 30,
  mileage: 20_000,
  weeklyMaintenanceCost: 0,
  weeklyFuelCost: 0,
  maxSpeed: 120,
  owned: true,
  reputationBonus: 0,
  speedBonus: 0,
};

const LOAN: Loan = {
  id: 'loan-1',
  name: 'Personal Loan',
  principal: 20_000,
  remaining: 15_000,
  rateAPR: 0.1,
  termWeeks: 104,
  weeklyPayment: 200,
  startWeek: 0,
  autoPay: false,
  type: 'personal',
  weeksRemaining: 75,
  interestRate: 0.1,
};

/** A player who holds something in EVERY group the modal can render. */
function richState(): GameState {
  const luxuryId = LUXURY_CATALOG[0].id;
  return createTestGameState({
    stats: { money: 12_500 },
    bankSavings: 40_000,
    banking: {
      ...BASE_BANKING,
      accounts: [
        // The two mirrors - these must NOT produce rows; they duplicate the
        // cash and savings above.
        account({ id: 'checking-default', type: 'checking', name: 'Checking', balance: 12_500 }),
        account({ id: 'savings-default', type: 'savings', name: 'Savings', balance: 40_000, baseAPR: 0.01 }),
        account({ id: 'hy-1', type: 'highYieldSavings', name: 'High Yield', balance: 75_000, baseAPR: 0.04, openedWeek: 4 }),
      ],
    },
    cryptos: [BTC],
    // D-5: laundered proceeds are spendable BTC and must appear as a row, not
    // only in the total. Held here so the sum invariant covers them too.
    darkWeb: LAUNDERED,
    stocks: {
      ...BASE_STOCKS,
      holdings: [{ symbol: 'ACME', shares: 100, currentPrice: 42, averagePrice: 30 }],
    },
    luxuryItems: [luxuryId],
    items: [LAPTOP],
    companies: [ACME],
    realEstate: [HOUSE],
    vehicles: [SEDAN],
    loans: [LOAN],
  });
}

describe('every value in the headline is visible in a row', () => {
  const { breakdown, rows } = buildNetWorthItemisation(richState());

  it('the fixture actually holds something in every group (guards everything below)', () => {
    // Without this, a fixture that silently stopped populating (a renamed field,
    // a changed shape) would leave `rows` short and the sum assertions would
    // pass on almost nothing - the vacuous-pass failure mode these tests exist
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

  it('dirty BTC is not itemised - it is not counted anywhere', () => {
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
    // Cash and savings survive - they never came from the accounts list.
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

describe('the itemised headline equals the canonical net worth', () => {
  // The modal exists to EXPLAIN the number on the card that opens it, and that
  // card shows the canonical `netWorth()` (lib/progress/achievements). For every
  // asset class BOTH engines count, the two must agree. They used to drift three
  // ways: the modal shaved a 1% liquidation fee off every asset, omitted savings
  // goals, and ignored credit-card debt. All three are now closed.
  //
  // `liquidState` holds one of every class the canonical figure counts - but no
  // company miners and no generic `items`, which the modal itemises and the
  // canonical figure does NOT (a known scope gap, asserted separately below).
  // `extra` merges through `createTestGameState` (Hard Rule #3 - never hand-build
  // or cast a GameState), so a caller can add e.g. companies/items on top of the
  // liquid baseline without spreading a raw state object.
  function liquidState(extra: Parameters<typeof createTestGameState>[0] = {}): GameState {
    const luxuryId = LUXURY_CATALOG[0].id;
    return createTestGameState({
      stats: { money: 12_500 },
      bankSavings: 40_000,
      banking: {
        ...BASE_BANKING,
        accounts: [
          account({ id: 'checking-default', type: 'checking', name: 'Checking', balance: 12_500 }),
          account({ id: 'savings-default', type: 'savings', name: 'Savings', balance: 40_000, baseAPR: 0.01 }),
          account({ id: 'hy-1', type: 'highYieldSavings', name: 'High Yield', balance: 75_000, baseAPR: 0.04, openedWeek: 4 }),
        ],
        savingsGoals: [
          { id: 'goal-1', name: 'Emergency Fund', targetAmount: 20_000, currentAmount: 8_500, category: 'emergency', createdWeek: 0 },
        ],
        creditCards: [
          { id: 'cc-1', name: 'Everyday Card', tier: 'standard', creditLimit: 10_000, balance: 3_200, baseAPR: 0.24, rewardsRate: 0.01, rewardsType: 'cashback', pendingRewards: 0, openedWeek: 0, minCreditScore: 600 },
        ],
      },
      cryptos: [BTC],
      darkWeb: LAUNDERED,
      stocks: { ...BASE_STOCKS, holdings: [{ symbol: 'ACME', shares: 100, currentPrice: 42, averagePrice: 30 }] },
      luxuryItems: [luxuryId],
      realEstate: [HOUSE],
      vehicles: [SEDAN],
      loans: [LOAN],
      ...extra,
    });
  }

  it('matches across every class both engines count (incl. savings goals & card debt)', () => {
    const state = liquidState();
    const { breakdown, rows } = buildNetWorthItemisation(state);
    expect(breakdown.netWorth).toBe(canonicalNetWorth(state));
    // The savings goal is a visible, named row - not a silent addition to the total.
    const savings = rows.find((r) => r.group === 'savings');
    expect(savings?.items.some((i) => /Emergency Fund/.test(i.name))).toBe(true);
  });

  it('the ONLY remaining gap is miners and generic items, which canonical omits', () => {
    // The modal itemises company mining hardware and generic owned items;
    // `netWorth()` counts neither. This locks that as the sole residual so a NEW
    // divergence (a re-introduced fee, a dropped term) cannot hide behind it.
    // If net worth should include hardware/inventory, that is a canonical change
    // for the owner to make - not something the modal decides on its own.
    const withHardware = liquidState({
      companies: [ACME], // 2 basic miners @ 2,500 = 5,000, income already in canonical
      items: [LAPTOP], // 1,200, no resale path in the canonical figure
    });
    const modal = buildNetWorthItemisation(withHardware).breakdown.netWorth;
    const canonical = canonicalNetWorth(withHardware);
    expect(modal - canonical).toBe(2 * 2_500 + 1_200);
  });
});

describe('computeNetWorth guards the transaction-fee option', () => {
  const assets = [{ id: 'a', type: 'cash', baseValue: 1_000 }];

  it('a non-finite fee falls back to the default instead of returning NaN', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const { netWorth } = computeNetWorth(assets, [], { transactionFee: bad });
      expect(isFinite(netWorth)).toBe(true);
      // Fell back to the 1% default: 1000 × (1 − 0.01) = 990.
      expect(netWorth).toBe(990);
    }
  });

  it('a finite fee outside [0,1] is clamped, not applied raw', () => {
    expect(computeNetWorth(assets, [], { transactionFee: 5 }).netWorth).toBe(0); // clamps to 1 → full haircut
    expect(computeNetWorth(assets, [], { transactionFee: -1 }).netWorth).toBe(1_000); // clamps to 0 → no haircut
  });
});

describe('an empty life produces an empty list, not a broken one', () => {
  it('no holdings → no rows, and no division by zero in the percentages', () => {
    const broke = createTestGameState({ stats: { money: 0 }, bankSavings: 0 });
    const { rows, breakdown } = buildNetWorthItemisation(broke);
    // Assert the TITLE. The loop below alone proved nothing: an empty `rows`
    // never enters it, and a non-empty `rows` passes as long as the values are
    // positive - so the test claimed "no rows" while checking neither case.
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
