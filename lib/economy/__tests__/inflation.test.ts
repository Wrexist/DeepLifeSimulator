import { applyWeeklyInflation, getInflatedPrice, getWeeklyInflationRate } from '../inflation';
import { GameState } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function createState(priceIndex: number, rate: number): GameState {
  return createTestGameState({
    economy: { inflationRateAnnual: rate, priceIndex },
  });
}

describe('inflation utilities', () => {
  it('updates price index by weekly inflation', () => {
    const state = createState(1, 0.52); // 52% annual -> 1% weekly
    const updated = applyWeeklyInflation(state);
    expect(updated.economy.priceIndex).toBeCloseTo(1.01);
  });

  it('scales prices by index', () => {
    expect(getInflatedPrice(100, 1.1)).toBe(110);
  });

  it('returns weekly inflation rate', () => {
    const state = createState(1, 0.52);
    expect(getWeeklyInflationRate(state)).toBeCloseTo(0.01);
  });
});
