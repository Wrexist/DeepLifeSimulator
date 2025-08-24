import { GameState } from '@/contexts/GameContext';

export function applyWeeklyInflation(state: GameState): GameState {
  const weeklyRate = state.economy.inflationRateAnnual / 52;
  return {
    ...state,
    economy: {
      ...state.economy,
      priceIndex: state.economy.priceIndex * (1 + weeklyRate),
    },
  };
}

export function getInflatedPrice(basePrice: number, priceIndex: number): number {
  return Math.round(basePrice * priceIndex);
}

export function getWeeklyInflationRate(state: GameState): number {
  return state.economy.inflationRateAnnual / 52;
}
