/**
 * Life capstones - a COMPLETION and a next-life consequence for non-wealth
 * paths (MP13).
 *
 * ## What was missing
 *
 * `lifeQuality` scores a life and `classifyLife` gives it a ribbon, and both
 * already weigh non-wealth signals (family, career, relationships) above money.
 * But neither carries anything INTO the next life: a player who raised a family
 * or mastered a craft ended with a word and an emoji, while the only mechanical
 * reason to keep a dynasty running was wealth prestige.
 *
 * A capstone is the missing half. When a life ends having genuinely completed a
 * non-wealth path, it pays LEGACY POINTS - the existing cross-life currency the
 * week loop already accrues and the Legacy Shop already spends. No new field,
 * no new currency, and nothing that changes the wealth prestige gate.
 *
 * ## Boundaries
 *
 * Wealth is deliberately not a capstone: money already has its own prestige
 * ladder, and adding one here would just move the same goal onto a second
 * scoreboard. A child is not counted on its own for the family capstone (every
 * child starts at a high bond); the marriage requirement is what makes it a
 * life the player chose rather than one that happened to them.
 */

import type { GameState } from '@/contexts/game/types';

export interface LifeCapstone {
  id: string;
  name: string;
  description: string;
  /** Legacy points granted to the dynasty when this capstone is earned. */
  legacyPoints: number;
  condition: (state: GameState) => boolean;
}

export const LIFE_CAPSTONES: LifeCapstone[] = [
  {
    id: 'capstone_family',
    name: 'The Family Life',
    description: 'Raised a family: married, with three or more children.',
    legacyPoints: 4,
    condition: (s) => Boolean(s.family?.spouse) && (s.family?.children?.length ?? 0) >= 3,
  },
  {
    id: 'capstone_career',
    name: 'The Mastered Craft',
    description: 'Reached the top rung of a career.',
    legacyPoints: 4,
    condition: (s) =>
      (Array.isArray(s.careers) ? s.careers : []).some(
        (c) => c?.accepted && ((c.level ?? 0) + 1) >= 6,
      ),
  },
  {
    id: 'capstone_community',
    name: 'The Community Pillar',
    description: 'Lived generously and kept a wide circle of close friends.',
    legacyPoints: 4,
    condition: (s) =>
      (s.karma?.score ?? 0) >= 60 && (Array.isArray(s.relationships) ? s.relationships : []).length >= 8,
  },
];

/** Ceiling on the legacy points one death can pay from capstones. */
export const MAX_CAPSTONE_LEGACY_POINTS = 8;

/** Every non-wealth capstone this life completed. */
export function earnedCapstones(
  state: GameState | null | undefined,
): LifeCapstone[] {
  if (!state) return [];
  return LIFE_CAPSTONES.filter((capstone) => {
    try {
      return capstone.condition(state);
    } catch {
      // A malformed life must not take the death path down with it.
      return false;
    }
  });
}

/**
 * Legacy points a completed non-wealth life pays into the next one. Capped, so
 * completing every path cannot out-earn the wealth ladder's own rewards.
 */
export function capstoneLegacyBonus(state: GameState | null | undefined): number {
  const total = earnedCapstones(state).reduce((sum, c) => sum + c.legacyPoints, 0);
  return Math.min(MAX_CAPSTONE_LEGACY_POINTS, total);
}
