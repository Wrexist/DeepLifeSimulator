import { GameState } from '@/contexts/game/types';
import { BASE_PRESTIGE_THRESHOLD, PrestigeData } from './prestigeTypes';
import { MAX_MULTIPLIER_LEVEL } from './prestigeConstants';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { getAchievementHunterPointsPerAchievement } from './applyBonuses';
import { getEarnedAchievementCount } from '@/lib/progress/earnedAchievements';
import { netWorth } from '@/lib/progress/achievements';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

/**
 * Breakdown of prestige points calculation
 */
export interface PrestigePointsBreakdown {
  basePoints: number; // From net worth
  achievementBonus: number;
  /** Achievement Hunter: points for every achievement claimed this life. */
  achievementHunterBonus: number;
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
 * Net-worth points paid by a prestige at exactly the first-prestige threshold.
 *
 * WHY THIS IS ANCHORED TO THE THRESHOLD (2026-10-17 owner call).
 *
 * The earn rate used to be a flat 100 points per $1M. That rate was set when
 * the first prestige needed $100M, so a threshold prestige paid 10,000 base
 * points - the scale the whole shop was priced on (45 bonuses, median 6,000,
 * legendaries 25,000-50,000). On 2026-03-09 (6e9bdc71) the threshold was cut
 * 10x to $10M "so first-time players can experience prestige" and the rate was
 * not touched, so every threshold prestige quietly started paying a TENTH of
 * what the shop was built around. Measured on the old formula: a realistic
 * first life at $10M earned 1,657 points (+1,000 for "First Prestige"); five
 * prestiges at the threshold banked 18,144 - not one legendary, 3.6% of the
 * shop's first levels - and the median bonus took three lives.
 *
 * Defining the payout RELATIVE to `BASE_PRESTIGE_THRESHOLD` is the root-cause
 * fix: a future threshold retune moves the points with it instead of silently
 * devaluing every bonus again.
 */
export const PRESTIGE_POINTS_AT_THRESHOLD = 10_000;

/**
 * The old flat rate, kept as a FLOOR: no net worth pays fewer points than it
 * did before the 2026-10-17 retune. It only binds above $1B, where the square
 * root below crosses back under it.
 */
export const MIN_PRESTIGE_POINTS_PER_MILLION = 100;

/**
 * Base prestige points for a net worth - the one place this curve lives.
 *
 *   - up to the threshold: linear, 1,000 per $1M ($5M = 5,000, $10M = 10,000)
 *   - past it: 10,000 x sqrt(net worth / $10M) ($40M = 20,000, $1B = 100,000)
 *   - never below 100 per whole $1M (the pre-retune formula)
 *
 * Concave past the threshold on purpose. Above $10M the economy already pays
 * passive income at diminishing efficiency (lib/economy/passiveIncome.ts), and
 * a linear 1,000/$1M would turn one long $100M life into 100,000 points - two
 * legendaries and most of the epics from a single reset. The square root keeps
 * playing on worth something (4x the threshold still doubles the payout) while
 * starting a new life stays the better way to earn, which is what a prestige
 * loop is for.
 */
export function netWorthPrestigePoints(netWorth: number): number {
  if (!(typeof netWorth === 'number' && isFinite(netWorth)) || netWorth <= 0) return 0;
  const ratio = netWorth / BASE_PRESTIGE_THRESHOLD;
  const curve = ratio <= 1
    ? ratio * PRESTIGE_POINTS_AT_THRESHOLD
    : Math.sqrt(ratio) * PRESTIGE_POINTS_AT_THRESHOLD;
  const floor = Math.floor(netWorth / 1_000_000) * MIN_PRESTIGE_POINTS_PER_MILLION;
  return Math.floor(Math.max(curve, floor));
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
  // Base points: the threshold-anchored curve above (10,000 at $10M).
  // R2-G: clamped at 0 inside it, so a negative net worth (debt-only player)
  // cannot produce negative prestige points that poison the save.
  const basePoints = netWorthPrestigePoints(netWorth);

  // Achievement bonus: +10 points per achievement unlocked, but only for ones
  // NOT already credited on a prior prestige. Achievements persist across resets,
  // so crediting the full count every time (the old behavior) let a player farm
  // the same achievements for points each prestige (H-5).
  const completedCount = getEarnedAchievementCount(gameState);
  const alreadyCredited = prestigeData.achievementsCreditedForPoints ?? 0;
  const newlyCreditedAchievements = Math.max(0, completedCount - alreadyCredited);
  const achievementBonus = newlyCreditedAchievements * 10;

  // Achievement Hunter (achievement_progress_multiplier): a flat payment for
  // every achievement claimed THIS life, on top of the anti-farm base above.
  //
  // WHY (owner call, 2026-10-18). It used to be +20%/level on the base above,
  // which only pays for pushing the lifetime PEAK count higher, at 10 points
  // each: the most it could ever return was 20% of 160 achievements x 10 =
  // 320 points, across every life, for a 4,000-point purchase (and 10,000 for
  // level 2). It could never pay for itself. Re-earning achievements in a new
  // life is exactly the hunt this bonus sells, so it pays per claim in this
  // life - a life that claims 40 earns 1,000 at level 1, so the price comes
  // back in about four such lives before the prestige multiplier. The base
  // ledger is untouched, so a player without the bonus still cannot farm.
  const achievementHunterBonus =
    getEarnedAchievementCount(gameState) *
    getAchievementHunterPointsPerAchievement(prestigeData.unlockedBonuses || []);

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
  const subtotal = basePoints + achievementBonus + achievementHunterBonus + generationBonus + ageBonus + 
                   careerBonus + propertyBonus + companyBonus + childBonus;
  
  // Apply multiplier
  const afterMultiplier = subtotal * multiplier;
  
  // Apply child path bonus
  const finalTotal = Math.floor(afterMultiplier * (1 + childPathBonus));

  return {
    basePoints,
    achievementBonus,
    achievementHunterBonus,
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
    // Weeks PLAYED in this life, not the absolute counter: `weeksLived` is
    // seeded from the starting age, so an heir taking over at 40 began at
    // 1,144 and the parent's overlapping years were counted a second time
    // (and The Long Road added 624 unplayed weeks). The Endurance contracts
    // read this total. Pre-v43 saves without `lifeStartWeek` fall back to the
    // raw counter, which is what they counted before. §4.2 / LATE-14.
    totalWeeksLived:
      currentLifetimeStats.totalWeeksLived + weeksSinceLifeStart(gameState.weeksLived, gameState.lifeStartWeek),
    maxNetWorth: Math.max(currentLifetimeStats.maxNetWorth, currentNetWorth),
    achievementsUnlocked: Math.max(currentLifetimeStats.achievementsUnlocked, completedAchievementsCount),
    generationsCompleted: Math.max(currentLifetimeStats.generationsCompleted, gameState.generationNumber || 1),
    totalChildren: currentLifetimeStats.totalChildren + children.length,
    careersMaxed: Math.max(currentLifetimeStats.careersMaxed, maxedCareers.length),
    propertiesOwned: Math.max(currentLifetimeStats.propertiesOwned, ownedProperties.length),
    companiesBuilt: Math.max(currentLifetimeStats.companiesBuilt, (gameState.companies || []).length),
  };
}

