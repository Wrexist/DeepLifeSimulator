import { applyCrimeTick, computePoliceFine } from '@/contexts/game/actions/weekly/applyCrimeTick';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

function encounter(cash: number, netWorth: number, roll = 0): WeekContext {
  const state = createTestGameState({ stats: { money: cash } });
  const ctx: WeekContext = {
    newStats: { ...state.stats },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 100,
    deferredCharges: 25,
  };
  applyCrimeTick({
    prevWantedLevel: 15,
    prevJailWeeks: 0,
    policeEncounterRoll: roll,
    netWorth,
  }, ctx);
  return ctx;
}

describe('police fine assessment and collection', () => {
  it.each([0, 500, 10_000, 1_000_000])(
    'moving wealth out of the wallet cannot erase the fine (cash %s)',
    cash => {
      const ctx = encounter(cash, 10_000_000);
      const paid = cash - ctx.newStats.money;
      const addedDebt = (ctx.deferredCharges ?? 0) - 25;
      expect(paid + addedDebt).toBe(500_000);
      expect(ctx.newStats.money).toBeGreaterThanOrEqual(0);
      expect(addedDebt).toBe(Math.max(0, 500_000 - cash));
      expect(ctx.notifications[0].message).toContain('$500,000');
    },
  );

  it('retains the cash-only fallback for callers without a net-worth estimate', () => {
    expect(computePoliceFine(50, undefined, 5)).toBe(3);
    expect(computePoliceFine(0, undefined, 5)).toBe(0);
    expect(computePoliceFine(10_000, Number.NaN, 14)).toBe(500);
  });

  it('caps the assessed wealth share even at extreme wanted levels', () => {
    expect(computePoliceFine(0, 10_000_000, 1_000)).toBe(500_000);
  });

  it('does not invent a debt when no police encounter occurs', () => {
    const ctx = encounter(500, 10_000_000, 1);
    expect(ctx.newStats.money).toBe(500);
    expect(ctx.deferredCharges).toBe(25);
    expect(ctx.notifications).toHaveLength(0);
  });
});
