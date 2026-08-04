import type { GameState } from '@/contexts/game/types';

/**
 * Achievements the player has actually earned.
 *
 * `claimedProgressAchievements` (the live claim store, written by the
 * claimAchievement action) is authoritative. The older `gameState.achievements[]`
 * array is deprecated and its `.completed` flag is NEVER set in normal play —
 * so every prestige-point bonus, inheritance learning multiplier, "Achiever"
 * ribbon, and family-tree memory that read it silently evaluated to zero. These
 * helpers point those consumers at the store that actually reflects play.
 */
export function getEarnedAchievementCount(
  state: Pick<GameState, 'claimedProgressAchievements'>
): number {
  return (state.claimedProgressAchievements || []).length;
}

/** Titles of earned achievements, for display (prestige keyAchievements, etc.). */
export function getEarnedAchievementNames(
  state: Pick<GameState, 'claimedProgressAchievements'>
): string[] {
  const claimed = new Set(state.claimedProgressAchievements || []);
  if (claimed.size === 0) return [];
  // Lazy require avoids a static import cycle through the onboarding barrel.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/src/features/onboarding/achievementsData') as {
    achievements: { id: string; title: string }[];
  };
  return (mod.achievements || []).filter((a) => claimed.has(a.id)).map((a) => a.title);
}

/**
 * Ids of every achievement this life has earned — claimed OR merely satisfied.
 *
 * Deliberately more permissive than `getEarnedAchievementCount`. That one
 * answers "how many rewards has the player collected", which is the right
 * question for prestige-point bonuses. This one answers "did this life meet the
 * condition", which is the right question for a scenario win condition: a
 * player who raised a child but never tapped the claim button still raised the
 * child, and losing a 60-gem scenario reward over an uncollected badge would be
 * a trap.
 *
 * `isAchievementEarned` evaluates the achievement's own `progressSpec` against
 * live state, so this needs no separate bookkeeping. 2026-07-31 audit round 3.
 */
export function getSatisfiedAchievementIds(state: GameState): string[] {
  // Lazy require for the same import-cycle reason as above.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/src/features/onboarding/achievementsData') as {
    achievements: { id: string }[];
    isAchievementEarned: (gs: GameState, id: string) => boolean;
  };
  const claimed = new Set(state.claimedProgressAchievements || []);
  return (mod.achievements || [])
    .map((a) => a.id)
    .filter((id) => claimed.has(id) || mod.isAchievementEarned(state, id));
}
