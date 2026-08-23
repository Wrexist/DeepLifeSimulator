import { GameState } from '@/contexts/game/types';
import { PrestigeData } from './prestigeTypes';
import { MAX_MULTIPLIER_LEVEL } from './prestigeConstants';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { getAchievementProgressMultiplier } from './applyBonuses';
import { getEarnedAchievementCount } from '@/lib/progress/earnedAchievements';
import { netWorth } from '@/lib/progress/achievements';

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
  // Base points: 100 points per $1M net worth.
  // R2-G: clamp at 0 so negative net worth (debt-only player) doesn't produce
  // negative prestige points that poison the save.
  const basePoints = Math.max(0, Math.floor(netWorth / 1_000_000) * 100);

  // Achievement bonus: +10 points per achievement unlocked, but only for ones
  // NOT already credited on a prior prestige. Achievements persist across resets,
  // so crediting the full count every time (the old behavior) let a player farm
  // the same achievements for points each prestige (H-5).
  const completedCount = getEarnedAchievementCount(gameState);
  const alreadyCredited = prestigeData.achievementsCreditedForPoints ?? 0;
  const newlyCreditedAchievements = Math.max(0, completedCount - alreadyCredited);
  // Achievement Hunter (achievement_progress_multiplier): +20% per level on
  // the points achievements pay here. This is the bonus's REAL wiring as of
  // 2026-08-23 — its original "+20% achievement progress rate" had no
  // consumer anywhere (achievements complete on thresholds; nothing computes
  // a progress rate), so a 4,000-point purchase was consumed for nothing.
  // Multiplying the payout keeps the anti-farm ledger intact: the count of
  // credited achievements is unchanged, only the points per new credit move.
  const hunterMultiplier = getAchievementProgressMultiplier(
    prestigeData.unlockedBonuses || [],
  );
  const achievementBonus = Math.round(newlyCreditedAchievements * 10 * hunterMultiplier);

  // Generation bonus: +50 points per *completed* generation.
  // R2-G: previously written as `(gameState.generationNumber || 1 - 1) * 50`,
  // which JS parses as `gameState.generationNumber || (1 - 1) = gameState.generationNumber || 0`
  // — so the intended "subtract 1 to count prior generations" never happened,
  // and first-generation (gen 1) players were getting +50 free points.
  const generationBonus = Math.max(0, (gameState.generationNumber || 1) - 1) * 50;

  // Age bonus: +1 point per year lived (max 100 points). Floor at 0 like its
  // siblings above — a sub-18 age (e.g. child-heir path) would otherwise make
  // this negative and silently subtract from the prestige total.
  const age = Math.floor(gameState.date?.age || ADULTHOOD_AGE);
  const ageBonus = Math.max(0, Math.min(100, age - ADULTHOOD_AGE));

  // Career bonus: +25 points per maxed career
  const maxedCareers = (gameState.careers || []).filter(c => {
    const maxLevel = c.levels?.length || 0;
    // R3-P2: `level` is 0-INDEXED and capped at `levels.length - 1` everywhere
    // else — `promotionGating` returns `max_level` at exactly that point, and
    // the promotion updater bails unless `levels[level + 1]` exists. So
    // `level >= levels.length` could never be true for a real career and both
    // this +25/career bonus and `lifetimeStats.careersMaxed` were permanently
    // zero, with `PrestigeModal` hiding the breakdown row on `careerBonus > 0`.
    //
    // The `maxLevel > 0` guard closes the mirror hazard: a save whose career
    // entry lacks a `levels` array gave `maxLevel = 0`, and `level 0 >= 0` would
    // now count it as maxed for free.
    return maxLevel > 0 && c.level >= maxLevel - 1;
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

  // STABILITY FIX: Cap prestige multiplier growth to prevent exponential trivialization
  // After MAX_MULTIPLIER_LEVEL, multiplier stops growing (prevents later prestiges from becoming trivial)
  // Multiplier: 1.1^(min(prestigeLevel, MAX_MULTIPLIER_LEVEL)) - 10% more points per prestige level
  //
  // SAFETY: This is safe because:
  // - Multiplier calculation is isolated to this function
  // - No other code depends on unbounded multiplier growth
  // - Capping at MAX_MULTIPLIER_LEVEL still provides 2.59x multiplier (significant but not exponential)
  // - Constant extracted to prestigeConstants.ts for easy tuning
  const cappedLevel = Math.min(prestigeData.prestigeLevel, MAX_MULTIPLIER_LEVEL);
  const multiplier = Math.pow(1.1, cappedLevel);

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
  const completedAchievementsCount = getEarnedAchievementCount(gameState);
  const maxedCareers = (gameState.careers || []).filter(c => {
    const maxLevel = c.levels?.length || 0;
    // R3-P2: `level` is 0-INDEXED and capped at `levels.length - 1` everywhere
    // else — `promotionGating` returns `max_level` at exactly that point, and
    // the promotion updater bails unless `levels[level + 1]` exists. So
    // `level >= levels.length` could never be true for a real career and both
    // this +25/career bonus and `lifetimeStats.careersMaxed` were permanently
    // zero, with `PrestigeModal` hiding the breakdown row on `careerBonus > 0`.
    //
    // The `maxLevel > 0` guard closes the mirror hazard: a save whose career
    // entry lacks a `levels` array gave `maxLevel = 0`, and `level 0 >= 0` would
    // now count it as maxed for free.
    return maxLevel > 0 && c.level >= maxLevel - 1;
  });
  const ownedProperties = (gameState.realEstate || []).filter(p => p.owned);
  const children = gameState.family?.children || [];

  // Canonical net worth (money + bank + stocks + real estate + companies +
  // vehicles + luxury − loans). This previously recomputed a divergent subset
  // (money + bank + realEstate purchase price only), which under-counted every
  // other asset class and used origination price instead of current value.
  // Reuse netWorth() so lifetime stats match the figure the rest of the game
  // reports.
  const currentNetWorth = netWorth(gameState);

  return {
    totalMoneyEarned: currentLifetimeStats.totalMoneyEarned + (gameState.stats.money || 0),
    totalWeeksLived: currentLifetimeStats.totalWeeksLived + (gameState.weeksLived || 0),
    maxNetWorth: Math.max(currentLifetimeStats.maxNetWorth, currentNetWorth),
    achievementsUnlocked: Math.max(currentLifetimeStats.achievementsUnlocked, completedAchievementsCount),
    generationsCompleted: Math.max(currentLifetimeStats.generationsCompleted, gameState.generationNumber || 1),
    totalChildren: currentLifetimeStats.totalChildren + children.length,
    careersMaxed: Math.max(currentLifetimeStats.careersMaxed, maxedCareers.length),
    propertiesOwned: Math.max(currentLifetimeStats.propertiesOwned, ownedProperties.length),
    companiesBuilt: Math.max(currentLifetimeStats.companiesBuilt, (gameState.companies || []).length),
  };
}

