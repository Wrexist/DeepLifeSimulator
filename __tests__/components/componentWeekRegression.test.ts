import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { getMarketAPRByAbsoluteWeek, getMarketAPRForGameWeek } from '@/utils/bankMarketAPR';
import { updateTenantSatisfactionForWeek } from '@/utils/realEstateWeekly';

describe('BankApp week counter regression', () => {
  it('uses weeksLived for APR when UI week cycles back to 1', () => {
    const state = createTestGameState({
      week: 1,
      weeksLived: 53,
    });

    const aprFromComponentPath = getMarketAPRForGameWeek(state.weeksLived, state.week);
    const aprFromAbsoluteWeek = getMarketAPRByAbsoluteWeek(53);
    const aprFromLegacyWeekOnly = getMarketAPRForGameWeek(undefined, 1);

    expect(aprFromComponentPath).toBeCloseTo(aprFromAbsoluteWeek, 10);
    expect(aprFromComponentPath).not.toBeCloseTo(aprFromLegacyWeekOnly, 10);
  });

  it('keeps APR stable across week-of-month changes when weeksLived is unchanged', () => {
    const aprWeekOne = getMarketAPRForGameWeek(60, 1);
    const aprWeekFour = getMarketAPRForGameWeek(60, 4);

    expect(aprWeekOne).toBeCloseTo(aprWeekFour, 10);
  });
});

describe('RealEstateApp weekly maintenance regression', () => {
  it('normalizes legacy cyclical maintenance week before decay checks', () => {
    // Legacy lastMaintenance=4 should map to absolute week 8 in this context.
    // That means only 1 week has passed, so satisfaction increases by +2.
    const nextSatisfaction = updateTenantSatisfactionForWeek({
      tenantSatisfaction: 80,
      lastMaintenance: 4,
      currentAbsoluteWeek: 9,
      currentWeekOfMonth: 1,
    });

    expect(nextSatisfaction).toBe(82);
  });

  it('applies decay when maintenance is overdue by absolute week count', () => {
    const nextSatisfaction = updateTenantSatisfactionForWeek({
      tenantSatisfaction: 80,
      lastMaintenance: 5,
      currentAbsoluteWeek: 11,
      currentWeekOfMonth: 3,
    });

    expect(nextSatisfaction).toBe(75);
  });
});
