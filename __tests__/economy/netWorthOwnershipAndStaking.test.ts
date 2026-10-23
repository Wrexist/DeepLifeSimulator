/**
 * ECO2-1 / ECO2-2 (second audit swarm, 2026-10-23): two holdings `netWorth`
 * valued wrong.
 *
 * ECO2-1 - an IPO paid the floated share out as cash (counted as `money`)
 * while the company kept being valued at 100% of its income, so the floated
 * share was counted twice.
 *
 * ECO2-2 - staking moves coins out of `cryptos[].owned` into a warehouse
 * position that hands every coin back at maturity, and `netWorth` read only
 * `owned`, so staking dropped net worth by the staked value.
 */
import { netWorth } from '@/lib/progress/achievements';
import { createTestGameState } from '../helpers/createTestGameState';
import { makeCrypto } from '../helpers/makeFinance';
import { createDefaultCompanyOverlay } from '@/lib/business/hustleLogic';
import { initialGameState } from '@/contexts/game/initialState';
import type { Company, GameState } from '@/contexts/game/types';

// Distinct money per case so the reference-keyed memo cannot serve a stale figure.
let uniqueMoney = 7_001;
const nextMoney = () => (uniqueMoney += 13);

const factory: Company = {
  id: 'factory',
  name: 'My Factory',
  type: 'factory',
  weeklyIncome: 10_000,
  baseWeeklyIncome: 10_000,
  upgrades: [],
  employees: 0,
  workerSalary: 500,
  workerMultiplier: 1.1,
  marketingLevel: 1,
  miners: {},
  warehouseLevel: 0,
};

function withCompany(ipo?: { ownershipPercent: number }): GameState {
  const overlay = createDefaultCompanyOverlay('factory', 100);
  const hustleApp = {
    ...(initialGameState.hustleApp ?? { companies: {}, lifetimeStats: createTestGameState().hustleApp!.lifetimeStats }),
    companies: {
      factory: ipo
        ? { ...overlay, ipo: { ...overlay.ipo, status: 'public' as const, ownershipPercent: ipo.ownershipPercent } }
        : overlay,
    },
  };
  return createTestGameState({
    stats: { money: nextMoney() },
    companies: [factory],
    hustleApp,
    cryptos: [],
    realEstate: [],
    loans: [],
  });
}

describe('ECO2-1: a public company is valued at the share the player still owns', () => {
  it('values a private company at 100% of annual income', () => {
    const s = withCompany();
    expect(netWorth(s) - s.stats.money).toBeCloseTo(10_000 * 52, 0);
  });

  it('values a company floated down to 60% at 60% of annual income', () => {
    const s = withCompany({ ownershipPercent: 60 });
    expect(netWorth(s) - s.stats.money).toBeCloseTo(10_000 * 52 * 0.6, 0);
  });

  it('recomputes when only the IPO overlay changes (memo key)', () => {
    const priv = withCompany();
    const pub: GameState = {
      ...priv,
      hustleApp: {
        ...priv.hustleApp!,
        companies: {
          factory: {
            ...priv.hustleApp!.companies.factory,
            ipo: { ...priv.hustleApp!.companies.factory.ipo, status: 'public', ownershipPercent: 75 },
          },
        },
      },
    };
    const before = netWorth(priv);
    const after = netWorth(pub);
    expect(before - after).toBeCloseTo(10_000 * 52 * 0.25, 0);
  });
});

describe('ECO2-2: staked coins still count', () => {
  it('staking leaves net worth unchanged', () => {
    const base = createTestGameState({
      stats: { money: nextMoney() },
      cryptos: [makeCrypto({ id: 'btc', price: 40_000, owned: 3 })],
      companies: [],
      realEstate: [],
      loans: [],
    });
    const staked: GameState = {
      ...base,
      cryptos: [makeCrypto({ id: 'btc', price: 40_000, owned: 1 })],
      warehouse: {
        level: 1,
        miners: {},
        stakingPositions: [
          { cryptoId: 'btc', amount: 2, lockWeeks: 4, startWeek: 0, startAbsoluteWeek: 0, lastClaimAbsoluteWeek: 0, rewardRate: 0.0025 },
        ],
      },
    };
    expect(netWorth(staked)).toBeCloseTo(netWorth(base), 6);
  });

  it('ignores a malformed position rather than throwing', () => {
    const s = createTestGameState({
      stats: { money: nextMoney() },
      cryptos: [makeCrypto({ id: 'btc', price: 40_000, owned: 0 })],
      companies: [],
      realEstate: [],
      loans: [],
      warehouse: {
        level: 1,
        miners: {},
        stakingPositions: [
          { cryptoId: 'btc', amount: Number.NaN, lockWeeks: 4, startWeek: 0, rewardRate: 0 },
          { cryptoId: 'nope', amount: 5, lockWeeks: 4, startWeek: 0, rewardRate: 0 },
        ],
      },
    });
    expect(netWorth(s)).toBe(s.stats.money);
  });
});
