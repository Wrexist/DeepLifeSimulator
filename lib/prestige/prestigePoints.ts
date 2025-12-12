import { GameState } from '@/contexts/game/types';
import { PrestigeData } from './prestigeTypes';

/**
 * Breakdown of prestige points calculation
 */
export interface PrestigePointsBreakdown {
  basePoints: number; // From net worth
  achievementBonus: number;
  generationBonus: number;
  ageBonus: number;
  careerBonus: number;
  propertyBonus: number;
  companyBonus: number;
  childBonus: number;
  childPathBonus: number; // +25% if choosing child path
  multiplier: number; // Based on prestige level
  total: number;
}

/**
 * Calculate prestige points earned from current game state
 * @param gameState Current game state
 * @param netWorth Current net worth
 * @param prestigeData Current prestige data
 * @param chosenPath Path chosen for prestige ('reset' or 'child')
 * @returns Breakdown of prestige points
 */
export function calculatePrestigePoints(
  gameState: GameState,
  netWorth: number,
  prestigeData: PrestigeData,
  chosenPath: 'reset' | 'child' = 'reset'
): PrestigePointsBreakdown {
  // Base points: 100 points per $1M net worth
  const basePoints = Math.floor(netWorth / 1_000_000) * 100;

  // Achievement bonus: +10 points per achievement unlocked
  const completedAchievements = (gameState.achievements || []).filter(a => a.completed);
  const achievementBonus = completedAchievements.length * 10;

  // Generation bonus: +50 points per generation completed
  const generationBonus = (gameState.generationNumber || 1 - 1) * 50;

  // Age bonus: +1 point per year lived (max 100 points)
  const age = Math.floor(gameState.date?.age || 18);
  const ageBonus = Math.min(100, age - 18);

  // Career bonus: +25 points per maxed career
  const maxedCareers = (gameState.careers || []).filter(c => {
    const maxLevel = c.levels?.length || 0;
    return c.level >= maxLevel;
  });
  const careerBonus = maxedCareers.length * 25;

  // Property bonus: +5 points per property owned
  const ownedProperties = (gameState.realEstate || []).filter(p => p.owned);
  const propertyBonus = ownedProperties.length * 5;

  // Company bonus: +50 points per company built
  const companyBonus = (gameState.companies || []).length * 50;

  // Child bonus: +20 points per child
  const children = gameState.family?.children || [];
  const childBonus = children.length * 20;

  // Child path bonus: +25% if choosing child path
  const childPathBonus = chosenPath === 'child' ? 0.25 : 0;

  // Multiplier: 1.1^(prestigeLevel) - 10% more points per prestige level
  const multiplier = Math.pow(1.1, prestigeData.prestigeLevel);

  // Calculate total before child path bonus
  const subtotal = basePoints + achievementBonus + generationBonus + ageBonus + 
                   careerBonus + propertyBonus + companyBonus + childBonus;
  
  // Apply multiplier
  const afterMultiplier = subtotal * multiplier;
  
  // Apply child path bonus
  const finalTotal = Math.floor(afterMultiplier * (1 + childPathBonus));

  return {
    basePoints,
    achievementBonus,
    generationBonus,
    ageBonus,
    careerBonus,
    propertyBonus,
    companyBonus,
    childBonus,
    childPathBonus: childPathBonus * 100, // Convert to percentage for display
    multiplier,
    total: finalTotal,
  };
}

/**
 * Calculate lifetime stats from current game state
 * @param gameState Current game state
 * @param currentLifetimeStats Existing lifetime stats
 * @returns Updated lifetime stats
 */
export function calculateLifetimeStats(
  gameState: GameState,
  currentLifetimeStats: PrestigeData['lifetimeStats']
): PrestigeData['lifetimeStats'] {
  const completedAchievements = (gameState.achievements || []).filter(a => a.completed);
  const maxedCareers = (gameState.careers || []).filter(c => {
    const maxLevel = c.levels?.length || 0;
    return c.level >= maxLevel;
  });
  const ownedProperties = (gameState.realEstate || []).filter(p => p.owned);
  const children = gameState.family?.children || [];

  // Calculate current net worth (simplified - would use actual net worth calculation)
  const netWorth = (gameState.stats.money || 0) + 
                   (gameState.bankSavings || 0) +
                   (gameState.realEstate || []).reduce((sum, p) => sum + (p.owned ? (p.price || 0) : 0), 0);

  return {
    totalMoneyEarned: currentLifetimeStats.totalMoneyEarned + (gameState.stats.money || 0),
    totalWeeksLived: currentLifetimeStats.totalWeeksLived + (gameState.weeksLived || 0),
    maxNetWorth: Math.max(currentLifetimeStats.maxNetWorth, netWorth),
    achievementsUnlocked: Math.max(currentLifetimeStats.achievementsUnlocked, completedAchievements.length),
    generationsCompleted: Math.max(currentLifetimeStats.generationsCompleted, gameState.generationNumber || 1),
    totalChildren: currentLifetimeStats.totalChildren + children.length,
    careersMaxed: Math.max(currentLifetimeStats.careersMaxed, maxedCareers.length),
    propertiesOwned: Math.max(currentLifetimeStats.propertiesOwned, ownedProperties.length),
    companiesBuilt: Math.max(currentLifetimeStats.companiesBuilt, (gameState.companies || []).length),
  };
}

