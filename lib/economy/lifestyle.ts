/**
 * Lifestyle Maintenance System
 * 
 * Wealth requires ongoing lifestyle costs that scale with net worth.
 * High lifestyle unlocks opportunities but has high maintenance.
 * Creates meaningful trade-offs: maintain lifestyle or save money.
 */

import { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';

export type LifestyleLevel = 'minimal' | 'modest' | 'comfortable' | 'affluent' | 'luxury' | 'elite';

export interface LifestyleEffects {
  level: LifestyleLevel;
  weeklyCost: number;
  reputationBonus: number; // Weekly reputation gain/loss
  relationshipMaintenance: number; // Relationship decay reduction
  unlocks: {
    careers: string[]; // Career IDs unlocked by this lifestyle
    events: string[]; // Event IDs more likely at this lifestyle
  };
}

/**
 * Calculate lifestyle level based on net worth
 * Lifestyle automatically scales with wealth (lifestyle inflation)
 */
export function calculateLifestyleLevel(gameState: GameState): LifestyleLevel {
  const currentNetWorth = netWorth(gameState);
  
  // Lifestyle tiers based on net worth
  if (currentNetWorth >= 50_000_000) return 'elite';      // $50M+
  if (currentNetWorth >= 10_000_000) return 'luxury';      // $10M-$50M
  if (currentNetWorth >= 1_000_000) return 'affluent';     // $1M-$10M
  if (currentNetWorth >= 100_000) return 'comfortable';    // $100K-$1M
  if (currentNetWorth >= 10_000) return 'modest';          // $10K-$100K
  return 'minimal';                                        // <$10K
}

/**
 * Calculate weekly lifestyle maintenance costs
 * Costs scale with net worth: 0.5% to 2% of net worth per week
 */
export function calculateLifestyleCosts(gameState: GameState): number {
  const currentNetWorth = netWorth(gameState);
  const level = calculateLifestyleLevel(gameState);
  
  // Cost percentages by lifestyle level
  // STABILITY FIX: Cap elite lifestyle at 1% (was 2%) to ensure passive income always covers costs
  // At ultra-high net worth ($50M+), passive income has diminishing returns (50% minimum efficiency)
  // Lifestyle costs at 2% would exceed passive income, creating impossible situation
  const costPercentages: Record<LifestyleLevel, number> = {
    minimal: 0,        // No lifestyle costs for minimal
    modest: 0.002,    // 0.2% of net worth
    comfortable: 0.005, // 0.5% of net worth
    affluent: 0.01,   // 1% of net worth
    luxury: 0.015,    // 1.5% of net worth
    elite: 0.01,      // 1% of net worth (reduced from 2% to prevent exceeding passive income)
  };
  
  const percentage = costPercentages[level];
  if (percentage === 0) return 0;
  
  // Calculate weekly cost
  const weeklyCost = Math.floor(currentNetWorth * percentage);
  
  // Cap at reasonable maximum to prevent extreme costs
  const maxWeeklyCost = 1_000_000; // $1M per week max
  return Math.min(weeklyCost, maxWeeklyCost);
}

/**
 * Get lifestyle effects (reputation, relationships, unlocks)
 */
export function getLifestyleEffects(gameState: GameState): LifestyleEffects {
  const level = calculateLifestyleLevel(gameState);
  const weeklyCost = calculateLifestyleCosts(gameState);
  
  // Reputation effects: higher lifestyle = reputation gain, lower = reputation loss
  const reputationEffects: Record<LifestyleLevel, number> = {
    minimal: -1,      // Low lifestyle hurts reputation
    modest: 0,        // Neutral
    comfortable: 1,   // Small reputation gain
    affluent: 2,      // Moderate reputation gain
    luxury: 3,        // High reputation gain
    elite: 5,         // Very high reputation gain
  };
  
  // Relationship maintenance: higher lifestyle reduces relationship decay
  const relationshipMaintenance: Record<LifestyleLevel, number> = {
    minimal: -2,      // Relationships decay faster
    modest: 0,        // Normal decay
    comfortable: 1,   // Slight reduction in decay
    affluent: 2,      // Moderate reduction
    luxury: 3,        // High reduction
    elite: 5,         // Very high reduction
  };
  
  // Lifestyle-gated careers
  const careerUnlocks: Record<LifestyleLevel, string[]> = {
    minimal: [],
    modest: [],
    comfortable: ['corporate'], // Unlock corporate at comfortable
    affluent: ['corporate', 'celebrity'], // Unlock celebrity at affluent
    luxury: ['corporate', 'celebrity', 'politician'], // Unlock politician at luxury
    elite: ['corporate', 'celebrity', 'politician'], // All unlocked at elite
  };
  
  return {
    level,
    weeklyCost,
    reputationBonus: reputationEffects[level],
    relationshipMaintenance: relationshipMaintenance[level],
    unlocks: {
      careers: careerUnlocks[level],
      events: [], // Can be expanded later
    },
  };
}

/**
 * Check if a career is unlocked by lifestyle
 */
export function isCareerUnlockedByLifestyle(
  careerId: string,
  gameState: GameState
): boolean {
  const effects = getLifestyleEffects(gameState);
  return effects.unlocks.careers.includes(careerId);
}
