/**
 * Elder "legacy planning" summary — pure read model.
 *
 * This does NOT rebuild any legacy/inheritance/prestige logic. It composes the
 * exact functions the death screen + prestige pipeline already use, so the elder
 * surface previews the SAME numbers the player will see at death:
 *   • canonical net worth      → netWorth()            (lib/progress/achievements)
 *   • estate passed to heirs    → computeInheritance() (lib/legacy/inheritance)
 *   • per-heir amount           → calculateChildInheritance() (lib/prestige/childStats)
 *   • achievements earned       → getEarnedAchievement*() (lib/progress/earnedAchievements)
 *   • family                    → gameState.family
 */
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { calculateChildInheritance } from '@/lib/prestige/childStats';
import { getEarnedAchievementCount, getEarnedAchievementNames } from '@/lib/progress/earnedAchievements';
import { getAge, isRetired } from './pension';

export interface ElderHeirPreview {
  id: string;
  name: string;
  /** Estimated cash this heir would inherit (matches the death-screen math). */
  inheritance: number;
  isHeirEligible: boolean;
}

export interface ElderLegacySummary {
  age: number;
  isRetired: boolean;
  generation: number;
  /** Canonical player net worth (matches leaderboard + previousLives records). */
  netWorth: number;
  /** Total estate that would pass on, per the death/legacy inheritance flow. */
  estateToHeirs: number;
  legacyBonuses: { incomeMultiplier: number; learningMultiplier: number; reputationBonus: number };
  achievementsCount: number;
  /** Up to 5 earned-achievement names for display. */
  topAchievements: string[];
  spouseName?: string;
  childrenCount: number;
  /** The strongest eligible heir (highest inheritance), if any children exist. */
  primaryHeir?: ElderHeirPreview;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && isFinite(v) ? v : fallback;

/**
 * Build the elder legacy-planning summary. Fully defensive — any sub-computation
 * that throws on malformed state falls back to a canonical/empty value so the UI
 * never crashes late in a long life.
 */
export function getElderLegacySummary(state: GameState): ElderLegacySummary {
  const canonicalNetWorth = Math.max(0, num(netWorth(state)));

  let estateToHeirs = canonicalNetWorth;
  let legacyBonuses = { incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 0 };
  try {
    const inh = computeInheritance(state);
    estateToHeirs = Math.max(0, num(inh.totalNetWorth, canonicalNetWorth));
    if (inh.legacyBonuses) legacyBonuses = inh.legacyBonuses;
  } catch {
    // keep canonical fallback
  }

  const children = Array.isArray(state?.family?.children) ? state.family.children : [];
  let primaryHeir: ElderHeirPreview | undefined;
  for (const child of children) {
    if (!child) continue;
    const eligible = child.isHeirEligible !== false;
    let inheritance = 0;
    try {
      inheritance = Math.max(0, num(calculateChildInheritance(estateToHeirs, child)));
    } catch {
      inheritance = 0;
    }
    const preview: ElderHeirPreview = {
      id: child.id,
      name: child.name || 'Heir',
      inheritance,
      isHeirEligible: eligible,
    };
    // Prefer eligible heirs; within that, the largest inheritance.
    if (
      !primaryHeir ||
      (eligible && !primaryHeir.isHeirEligible) ||
      (eligible === primaryHeir.isHeirEligible && inheritance > primaryHeir.inheritance)
    ) {
      primaryHeir = preview;
    }
  }

  // Defensive per the file contract: an achievement helper that throws must not
  // crash the elder surface.
  let achievementsCount = 0;
  let topAchievements: string[] = [];
  try {
    achievementsCount = getEarnedAchievementCount(state);
    topAchievements = getEarnedAchievementNames(state).slice(0, 5);
  } catch {
    achievementsCount = 0;
    topAchievements = [];
  }

  return {
    age: getAge(state),
    isRetired: isRetired(state),
    generation: Math.max(1, num(state?.generationNumber, 1)),
    netWorth: canonicalNetWorth,
    estateToHeirs,
    legacyBonuses,
    achievementsCount,
    topAchievements,
    spouseName: state?.family?.spouse?.name,
    childrenCount: children.length,
    primaryHeir,
  };
}
