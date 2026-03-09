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
    expect(result.breakdown.upkeep).toBe(120);
    expect(result.breakdown.loans).toBe(50);
    expect(result.total).toBe(170);
  });
});
