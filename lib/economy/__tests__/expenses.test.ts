import { calcWeeklyExpenses } from '../expenses';
import { GameState, RealEstate } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

interface TestLoan {
  weeklyPayment: number;
}

function createState(overrides: Partial<GameState & { loans?: TestLoan[] }>): GameState & { loans?: TestLoan[] } {
  const baseState = createTestGameState(overrides);
  // Add test-specific loan property if needed
  if ('loans' in overrides) {
    return { ...baseState, loans: overrides.loans };
  }
  return baseState;
}

describe('calcWeeklyExpenses', () => {
  it('sums upkeep and loan payments', () => {
    const properties: RealEstate[] = [
      {
        id: 'house',
        name: 'House',
        price: 100000,
        weeklyHappiness: 0,
        weeklyEnergy: 0,
        owned: true,
        interior: [],
        upgradeLevel: 1,
        rent: 500,
        upkeep: 100,
      },
    ];
    const state = createState({
      realEstate: properties,
      loans: [{ 
        id: 'test', 
        name: 'Test Loan',
        principal: 1000, 
        remaining: 1000,
        rateAPR: 0.05,
        termWeeks: 20,
        weeklyPayment: 50, 
        weeksRemaining: 20, 
        interestRate: 0.05,
        startWeek: 1,
        autoPay: false,
        type: 'personal'
      }],
    });
    const result = calcWeeklyExpenses(state);
    // 100 upkeep + 20 tier bonus + 23 property tax on a $100k home
    // (1.2%/yr ÷ 52). The tax joined this row on 2026-08-25 because the tick
    // charges it through the same `housingUpkeep` line - an owned home used to
    // cost NOTHING to hold, which is why nothing recurring scaled with wealth.
    expect(result.breakdown.upkeep).toBe(143);
    expect(result.breakdown.loans).toBe(50);
    expect(result.total).toBe(193); // 143 upkeep (incl. property tax) + 50 loans
  });
});
