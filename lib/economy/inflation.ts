import { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// Sane bounds so a runaway annual rate can't compound the price index to Infinity
// (which validateGameState treats as critical → data reset). 50% annual inflation
// is already extreme; a 10x cumulative index caps lifetime drift.
const MAX_ANNUAL_INFLATION = 0.5;
const MAX_PRICE_INDEX = 10;

export function applyWeeklyInflation(state: GameState): GameState {
  // CRITICAL: Validate all inputs before calculation to prevent NaN/Infinity
  const rawAnnual = typeof state.economy?.inflationRateAnnual === 'number' && isFinite(state.economy.inflationRateAnnual) && state.economy.inflationRateAnnual >= 0
    ? state.economy.inflationRateAnnual
    : 0.02; // Default 2% annual inflation
  const inflationRateAnnual = Math.min(MAX_ANNUAL_INFLATION, rawAnnual);
  const currentPriceIndex = typeof state.economy?.priceIndex === 'number' && isFinite(state.economy.priceIndex) && state.economy.priceIndex > 0
    ? state.economy.priceIndex
    : 1; // Default price index

  // Already at the ceiling — nothing further to compound.
  if (currentPriceIndex >= MAX_PRICE_INDEX) {
    return state;
  }

  const weeklyRate = inflationRateAnnual / WEEKS_PER_YEAR;
  if (!isFinite(weeklyRate) || weeklyRate < 0) {
    // If calculation fails, return state unchanged
    return state;
  }

  const newPriceIndex = Math.min(MAX_PRICE_INDEX, currentPriceIndex * (1 + weeklyRate));
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
