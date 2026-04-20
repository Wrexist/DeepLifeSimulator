import type { GameState } from '@/contexts/game/types';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

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
  const baseAge = 80; // Base life expectancy
  const health = state.stats.health || 100;
  const happiness = state.stats.happiness || 100;
  const fitness = state.stats.fitness || 0;
  const age = state.date?.age || ADULTHOOD_AGE;
  
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

