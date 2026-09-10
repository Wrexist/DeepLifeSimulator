import { runPersona } from '../helpers/earlyGameSim';
import type { GameState } from '@/contexts/game/types';
import { PROPERTY_CATALOG } from '@/lib/realEstate/catalog';

// Exercise the production week transition without background disk writes.
jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

describe('weekly recap reports cash actually received and paid', () => {
  jest.setTimeout(120000);

  const run = (cash: number, change: (state: GameState) => GameState = state => state) => runPersona({
    name: 'recap-cash', weeks: 1, seed: 42, policy: () => {},
    mutateSeed: state => change({ ...state, stats: { ...state.stats, money: cash } }),
  });

  it.each([
    { tier: undefined, rent: 0, after: 10030 },
    { tier: 'shared-room', rent: 45, after: 9985 },
    { tier: 'bedsit', rent: 80, after: 9950 },
  ])('includes the $rent paid for an established $tier tenancy', async ({ tier, rent, after }) => {
    const result = await run(10000, state => ({
      ...state, rental: tier ? { tierId: tier, startedWeek: state.weeksLived - 1 } : undefined,
    }));
    expect(result.finalState.stats.money).toBe(after);
    expect(result.finalState.weekResult).toMatchObject({
      incomeEarned: 30, expensesPaid: rent, netChange: after - 10000,
    });
    expect(result.rows[0].tickDelta).toBe(after - 10000);
  });

  it('does not report another rent payment during the prepaid signing week', async () => {
    const result = await run(10000, state => ({
      ...state, rental: { tierId: 'bedsit', startedWeek: state.weeksLived },
    }));
    expect(result.finalState.stats.money).toBe(10030);
    expect(result.finalState.weekResult).toMatchObject({ incomeEarned: 30, expensesPaid: 0, netChange: 30 });
  });

  it('reports only the cash paid when rent becomes overdue', async () => {
    const result = await run(0, state => ({
      ...state, rental: { tierId: 'bedsit', startedWeek: state.weeksLived - 1 },
    }));
    expect(result.finalState.overdueBalance).toBeGreaterThan(0);
    expect(result.finalState.stats.money).toBe(0);
    expect(result.finalState.weekResult).toMatchObject({ incomeEarned: 30, expensesPaid: 30, netChange: 0 });
  });

  it('includes cash used to settle previous arrears', async () => {
    const result = await run(10000, state => ({ ...state, overdueBalance: 100 }));
    expect(result.finalState.overdueBalance).toBe(0);
    expect(result.finalState.stats.money).toBe(9930);
    expect(result.finalState.weekResult).toMatchObject({ incomeEarned: 30, expensesPaid: 100, netChange: -70 });
  });

  it('reports realized landlord income and reconciles the actual cash change', async () => {
    const result = await run(10000, state => ({
      ...state,
      realEstate: [{
        ...PROPERTY_CATALOG[0], owned: true, currentResidence: false,
        currentValue: 200000, price: 200000, condition: 95,
        marketCycle: 'stable', cycleWeeksRemaining: 26,
        status: 'rented', rentMode: 'longTerm', rent: 1500,
        tenant: { id: 'recap-tenant', name: 'Sam', satisfaction: 95, movedInWeek: state.weeksLived - 1, weeklyRent: 1500 },
      }],
    }));
    const recap = result.finalState.weekResult!;
    // The tenant tick clamps the asking rent for this property and deducts
    // maintenance before crediting cash. The $30 base income alone is not enough.
    expect(recap.incomeEarned).toBe(792);
    expect(recap.expensesPaid).toBeGreaterThan(0);
    expect(recap.netChange).toBe(result.rows[0].tickDelta);
    if (typeof recap.incomeEarned !== 'number' || typeof recap.expensesPaid !== 'number') {
      throw new Error('A completed weekly recap must contain income and paid expenses');
    }
    expect(recap.incomeEarned - recap.expensesPaid).toBe(recap.netChange);
  });
});
