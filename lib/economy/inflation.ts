import { GameState } from '@/contexts/GameContext';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export function applyWeeklyInflation(state: GameState): GameState {
  // CRITICAL: Validate all inputs before calculation to prevent NaN/Infinity
  const inflationRateAnnual = typeof state.economy?.inflationRateAnnual === 'number' && isFinite(state.economy.inflationRateAnnual) && state.economy.inflationRateAnnual >= 0
    ? state.economy.inflationRateAnnual
    : 0.02; // Default 2% annual inflation
  const currentPriceIndex = typeof state.economy?.priceIndex === 'number' && isFinite(state.economy.priceIndex) && state.economy.priceIndex > 0
    ? state.economy.priceIndex
    : 1; // Default price index
  
  const weeklyRate = inflationRateAnnual / WEEKS_PER_YEAR;
  if (!isFinite(weeklyRate) || weeklyRate < 0) {
    // If calculation fails, return state unchanged
    return state;
  }
  
  const newPriceIndex = currentPriceIndex * (1 + weeklyRate);
  // CRITICAL: Validate result before returning
  if (!isFinite(newPriceIndex) || newPriceIndex <= 0) {
    // If calculation fails, return state unchanged
    return state;
  }
  
  return {
    ...state,
    economy: {
      ...state.economy,
      priceIndex: newPriceIndex,
    },
  };
}

export function getInflatedPrice(basePrice: number, priceIndex: number): number {
  // CRITICAL: Validate inputs before calculation to prevent NaN/Infinity
  const safeBasePrice = typeof basePrice === 'number' && isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  const safePriceIndex = typeof priceIndex === 'number' && isFinite(priceIndex) && priceIndex > 0 ? priceIndex : 1;
  
  const inflatedPrice = safeBasePrice * safePriceIndex;
  // CRITICAL: Validate result before returning
  if (!isFinite(inflatedPrice) || inflatedPrice < 0) {
    return safeBasePrice; // Return base price if calculation fails
  }
  
  return Math.round(inflatedPrice);
}

export function getWeeklyInflationRate(state: GameState): number {
  // CRITICAL: Validate input before division to prevent NaN/Infinity
  const inflationRateAnnual = typeof state.economy?.inflationRateAnnual === 'number' && isFinite(state.economy.inflationRateAnnual) && state.economy.inflationRateAnnual >= 0
    ? state.economy.inflationRateAnnual
    : 0.02; // Default 2% annual inflation
  
  const weeklyRate = inflationRateAnnual / WEEKS_PER_YEAR;
  // CRITICAL: Validate result before returning
  if (!isFinite(weeklyRate) || weeklyRate < 0) {
    return 0.02 / WEEKS_PER_YEAR; // Return safe default (2% annual / 52 weeks)
  }
  
  return weeklyRate;
}
