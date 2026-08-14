
/**
 * Lifetime statistics tracked across all prestiges
 */
export interface LifetimeStats {
  totalMoneyEarned: number;
  totalWeeksLived: number;
  maxNetWorth: number;
  achievementsUnlocked: number;
  generationsCompleted: number;
  totalChildren: number;
  careersMaxed: number;
  propertiesOwned: number;
  companiesBuilt: number;
}

/**
 * Record of a single prestige event
 */
export interface PrestigeRecord {
  prestigeNumber: number;
  netWorthAtPrestige: number;
  ageAtPrestige: number;
  weeksLived: number;
  prestigePointsEarned: number;
  timestamp: number;
  chosenPath: 'reset' | 'child';
  childId?: string; // If child path was chosen
  keyAchievements?: string[]; // Notable achievements from that life
}

/**
 * Complete prestige data structure
 */
export interface PrestigeData {
  prestigeLevel: number; // Current prestige level (0 = no prestige)
  prestigePoints: number; // Total points earned across all prestiges
  totalPrestiges: number; // Count of prestige resets
  lifetimeStats: LifetimeStats; // Track lifetime achievements
  unlockedBonuses: string[]; // IDs of purchased bonuses
  prestigeHistory: PrestigeRecord[]; // History of all prestiges
  /**
   * How many completed achievements have already been credited toward prestige
   * points. Achievements persist across resets, so without this each one paid
   * out +10 on EVERY prestige (H-5 farming). Only achievements earned since the
   * last prestige count. Optional for backward-compat with old saves (treated
   * as 0, which preserves the original behavior on the first prestige).
   */
  achievementsCreditedForPoints?: number;
  /**
   * IDs of prestige achievements (see lib/prestige/prestigeAchievements.ts) whose
   * point reward has already been granted. Guarantees each achievement pays out
   * exactly once and persists across prestige resets. Optional/additive for
   * backward-compat with old saves — absent is treated as [] (no achievements
   * claimed yet), so the first evaluation pass retroactively catches veterans up.
   */
  claimedPrestigeAchievements?: string[];
  /**
   * IDs of Life Ambitions (see lib/ambitions/catalog.ts) whose one-time payoff
   * has already been granted. The gems + prestigePoints portion of an ambition
   * payoff credits accumulators that PERSIST across prestige, while the per-life
   * gate (`ambitionRewardClaimed`) resets — so without a cross-life stamp the
   * same ambitionId could be re-fulfilled for gems/PP every prestige cycle.
   * Preserved across `createResetGameState`. Optional/additive for backward-compat
   * with old saves — absent is treated as [] (nothing claimed yet).
   */
  claimedAmbitions?: string[];
  /**
   * IDs of progress achievements (src/features/onboarding/achievementsData) whose
   * gem reward has already been minted. `claimedProgressAchievements` is per-life
   * and resets on prestige, so this cross-life set is the authoritative guard that
   * makes the gem grant one-time-ever. Preserved across `createResetGameState`.
   * Optional/additive for old saves — absent is treated as [] (nothing minted yet),
   * so a fresh save mints normally on first claim.
   */
  claimedAchievementIds?: string[];
}

/**
 * Default prestige data for new games
 */
export const defaultPrestigeData: PrestigeData = {
  prestigeLevel: 0,
  prestigePoints: 0,
  totalPrestiges: 0,
  lifetimeStats: {
    totalMoneyEarned: 0,
    totalWeeksLived: 0,
    maxNetWorth: 0,
    achievementsUnlocked: 0,
    generationsCompleted: 0,
    totalChildren: 0,
    careersMaxed: 0,
    propertiesOwned: 0,
    companiesBuilt: 0,
  },
  unlockedBonuses: [],
  prestigeHistory: [],
  achievementsCreditedForPoints: 0,
  claimedPrestigeAchievements: [],
  claimedAmbitions: [],
  claimedAchievementIds: [],
};

/**
 * Base prestige threshold - net worth required for first prestige.
 * Lowered from $100M to $10M so first-time players can experience prestige
 * without an extreme grind. Subsequent prestiges scale up 25% each.
 */
export const BASE_PRESTIGE_THRESHOLD = 10_000_000; // $10M

/**
 * Calculate the prestige threshold based on current prestige level.
 * ANTI-EXPLOIT: 25% increase per prestige to counteract income multiplier bonuses.
 * Level 0: $10M, Level 1: $12.5M, Level 2: $15.6M, Level 3: $19.5M, Level 4: $24.4M, etc.
 */
export function getPrestigeThreshold(prestigeLevel: number): number {
  if (prestigeLevel === 0) {
    return BASE_PRESTIGE_THRESHOLD; // First prestige: $10M
  }
  // Each prestige increases threshold by 25% (compound)
  return Math.floor(BASE_PRESTIGE_THRESHOLD * Math.pow(1.25, prestigeLevel));
}

/**
 * Legacy constant for backward compatibility
 * @deprecated Use getPrestigeThreshold() instead
 */
export const PRESTIGE_THRESHOLD = BASE_PRESTIGE_THRESHOLD;

/**
 * Prestige path options
 */
export type PrestigePath = 'reset' | 'child';


/**
 * Is the player eligible to prestige RIGHT NOW?
 *
 * Derived from net worth against the level's threshold rather than read from
 * `state.prestigeAvailable` — that flag is only ever written FALSE (see
 * prestigeExecution), so anything gated on it was dead: the Life Chapter goal
 * could not complete, its reward was unclaimable, and the home PrestigeButton
 * never rendered. The flag is still honoured when set, so DevTools can force it.
 * 2026-07-28 audit UX-1.
 *
 * Lives here, next to the threshold it compares against, so the chapter goal and
 * both UI gates share one answer.
 */
export function isPrestigeAvailable(state: {
  prestigeAvailable?: boolean;
  prestige?: { prestigeLevel?: number };
}): boolean {
  if (state?.prestigeAvailable === true) return true;
  // The one lazy require in this directory that stays, and the only one of the
  // thirty across the six held-back directories that turned out to be doing a
  // job. Measured 2026-08-14 rather than assumed:
  //
  //   this module's static closure          1 module  /   161 LOC
  //   @/lib/progress/achievements           9 modules / 5,949 LOC (pulls @/lib/luxury)
  //
  // and `prestigeTypes` is imported for `defaultPrestigeData` by
  // `contexts/game/initialState.ts` — about the lowest-level module there is —
  // plus `lib/progress/lifeChapters` and six components. A static import here
  // would drag ~6k LOC into initialState's module-init graph to serve one
  // function that most importers never call.
  //
  // Note what it is NOT: this is not a cycle-breaker (achievements does not
  // reach prestigeTypes), and it does not degrade types — the
  // `as typeof import(...)` keeps `netWorth` fully typed, which is exactly the
  // "typed lazy getter" CLAUDE.md §5 asks for. The rule is off for this line
  // only, on those grounds.
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-require-imports
  const { netWorth } = require('@/lib/progress/achievements') as typeof import('@/lib/progress/achievements');
  return netWorth(state as never) >= getPrestigeThreshold(state?.prestige?.prestigeLevel ?? 0);
}
