import type { GameState } from '@/contexts/game/types';
import { ADULTHOOD_AGE, BASE_LIFE_EXPECTANCY } from '@/lib/config/gameConstants';

/**
 * Calculate life expectancy based on health, happiness, and lifestyle
 */
export interface LifeExpectancyResult {
  baseAge: number;
  healthModifier: number;
  happinessModifier: number;
  lifestyleModifier: number;
  totalLifeExpectancy: number;
  yearsRemaining: number;
  recommendations: string[];
}

/**
 * Calculate life expectancy
 */
export function calculateLifeExpectancy(state: GameState): LifeExpectancyResult {
  const baseAge = BASE_LIFE_EXPECTANCY;
  // BUGFIX: `||` treats health/happiness 0 as falsy and falls back to 100,
  // making a dying player look perfectly healthy in the life-expectancy UI.
  const health = state.stats?.health ?? 100;
  const happiness = state.stats?.happiness ?? 100;
  const fitness = state.stats?.fitness ?? 0;
  const age = state.date?.age ?? ADULTHOOD_AGE;
  
  // Health modifier: ±0.5 years per health point above/below 50
  const healthModifier = (health - 50) * 0.5;
  
  // Happiness modifier: ±0.3 years per happiness point above/below 50
  const happinessModifier = (happiness - 50) * 0.3;
  
  // Lifestyle factors
  let lifestyleModifier = 0;
  
  // Fitness bonus
  if (fitness >= 80) {
    lifestyleModifier += 5; // Very fit
  } else if (fitness >= 60) {
    lifestyleModifier += 3; // Fit
  } else if (fitness < 30) {
    lifestyleModifier -= 3; // Unfit
  }
  
  // Check for negative lifestyle factors (would need to track these)
  // For now, use health/happiness as proxies
  
  const totalLifeExpectancy = baseAge + healthModifier + happinessModifier + lifestyleModifier;
  const yearsRemaining = Math.max(0, totalLifeExpectancy - age);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (health < 70) {
    recommendations.push('Improve your health to increase life expectancy');
  }
  if (happiness < 70) {
    recommendations.push('Increase happiness for a longer, healthier life');
  }
  if (fitness < 50) {
    recommendations.push('Regular exercise can add years to your life');
  }
  if (health >= 90 && happiness >= 90 && fitness >= 80) {
    recommendations.push('Excellent lifestyle! Keep it up for maximum longevity');
  }
  
  return {
    baseAge,
    healthModifier,
    happinessModifier,
    lifestyleModifier,
    totalLifeExpectancy: Math.round(totalLifeExpectancy),
    yearsRemaining: Math.round(yearsRemaining),
    recommendations,
  };
}

/** The earliest the old-age ramp can start — neglect shortens, never a cliff. */
export const LONGEVITY_PIVOT_MIN = 72;
/** The latest it can be pushed — a cared-for life buys real extra years. */
export const LONGEVITY_PIVOT_MAX = 92;

/**
 * The age at which the old-age death ramp begins for THIS life.
 *
 * ## Why this exists (2026-08-24 owner-approved balance pass)
 *
 * For its whole life this module was DISPLAY-ONLY: `calculateLifeExpectancy`
 * fed one readout in StatisticsApp while actual old-age death was a pure
 * function of `age - 80` — a player at 1 health lived exactly as long as one
 * at 100, so the wellbeing stats had no long-horizon consequence at all.
 *
 * The death roll now ramps from this pivot instead of the fixed 80. The raw
 * expectancy spans ~37..125 (health ±25y, happiness ±15y, fitness +5/-3), far
 * too wide to plug in raw, so it is clamped to [72, 92]:
 *   - the floor keeps neglect a GRADIENT, not a punishment cliff (at most
 *     eight years earlier than the old fixed ramp — §27 of the design brief),
 *   - the ceiling keeps a perfect life mortal (the immortality unlocks remain
 *     the only way out of the roll).
 * The ramp's quadratic slope is unchanged, so at pivot+N the odds are exactly
 * what they used to be at 80+N. Guarded: a throwing expectancy model returns
 * the historical 80, never a crash inside the week loop.
 */
export function longevityPivot(state: GameState): number {
  try {
    const expectancy = calculateLifeExpectancy(state).totalLifeExpectancy;
    if (!Number.isFinite(expectancy)) return 80;
    return Math.max(LONGEVITY_PIVOT_MIN, Math.min(LONGEVITY_PIVOT_MAX, expectancy));
  } catch {
    return 80;
  }
}

