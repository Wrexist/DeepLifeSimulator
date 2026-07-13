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
