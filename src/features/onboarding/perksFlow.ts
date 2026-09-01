/**
 * Perk selection logic for the onboarding Perks screen.
 *
 * Extracted from Perks.tsx — pure functions for sorting, locking, and benefit display.
 */

import { STAT_IDENTITY } from '@/lib/config/statIdentity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerkEffects {
  incomeMultiplier?: number;
  statBoosts?: Record<string, number>;
}

export interface PerkDefinition {
  id: string;
  title: string;
  description: string;
  effects: PerkEffects;
  rarity: string;
  unlock?: { type: 'achievement'; achievementId: string };
  icon: any;
  requirement: string;
}

export interface PerkBenefit {
  stat: string;
  value: number;
  type: 'stat' | 'income' | 'start';
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Sort perks: unlocked first, then by rarity within each group. */
export function sortPerksByUnlockStatus(
  perksList: PerkDefinition[],
  permanentPerkIds: string[],
  earnedAchievementIds: string[]
): PerkDefinition[] {
  return [...perksList].sort((a, b) => {
    const aUnlocked = isPerkUnlocked(a, permanentPerkIds, earnedAchievementIds);
    const bUnlocked = isPerkUnlocked(b, permanentPerkIds, earnedAchievementIds);

    if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;

    const rarityOrder: Record<string, number> = { Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 };
    const aR = rarityOrder[a.rarity] || 0;
    const bR = rarityOrder[b.rarity] || 0;
    return aR - bR;
  });
}

// ---------------------------------------------------------------------------
// Lock / unlock checks
// ---------------------------------------------------------------------------

/**
 * A perk is unlocked if it has no requirement, is permanent, or its achievement
 * has been earned.
 *
 * `earnedAchievementIds` MUST come from `getSatisfiedAchievementIds(state)`
 * (`lib/progress/earnedAchievements.ts`) — the live achievement system, where
 * completion is derived from each achievement's `progressSpec` against current
 * state, plus anything already in `claimedProgressAchievements`.
 *
 * It used to read `gameState.achievements[].completed`. That array is the
 * deprecated catalogue seeded in `initialState.ts`, and its `completed` flag has
 * no writer in shipping code: `evaluateAchievements` is an explicit no-op stub,
 * so its only caller `checkAchievements` does nothing. The single exception is a
 * one-off `luxury_life` flip in `GameActionsContext`. Every perk in
 * `perksData.ts` carries an `unlock`, so every perk evaluated against an
 * all-false list and rendered permanently disabled — the perk step was a gallery
 * of things no amount of play could ever grant. Same failure and same fix as
 * GP-3 on the Progression screen and the scenario win conditions.
 */
export function isPerkUnlocked(
  perk: PerkDefinition,
  permanentPerkIds: string[],
  earnedAchievementIds: string[]
): boolean {
  if (!perk.unlock) return true;
  if (permanentPerkIds.includes(perk.id)) return true;
  return earnedAchievementIds.includes(perk.unlock.achievementId);
}

/** A perk is locked if it has an unlock requirement AND is not permanent AND its achievement is unearned. */
export function isPerkLocked(
  perk: PerkDefinition,
  permanentPerkIds: string[],
  earnedAchievementIds: string[]
): boolean {
  return !isPerkUnlocked(perk, permanentPerkIds, earnedAchievementIds);
}

/**
 * Player-facing line under a locked perk, e.g. "Requires: Fitness Deity".
 *
 * The card used to print the raw slug (`Requires achievement: fitness_deity`),
 * which named an internal id the player has never seen anywhere in the app. The
 * title is resolved from the live catalogue; if an id ever stops resolving the
 * copy degrades to the slug rather than rendering "Requires: undefined", and
 * `perksCatalogueIntegrity.test.ts` fails the build for it.
 */
export function getPerkUnlockRequirementText(perk: PerkDefinition): string {
  if (!perk.unlock) return '';
  return `Requires: ${getAchievementTitle(perk.unlock.achievementId)}`;
}

/** Title of a live achievement, falling back to its id. */
export function getAchievementTitle(achievementId: string): string {
  // Lazy require: keeps this pure-logic module's init free of the achievement
  // catalogue's asset `require()`s, and mirrors the pattern already used in
  // `lib/progress/earnedAchievements.ts` for the same dependency.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./achievementsData') as {
    achievements: { id: string; title: string }[];
  };
  return (mod.achievements || []).find((a) => a.id === achievementId)?.title ?? achievementId;
}

/** Whether a perk is a purchased permanent perk. */
export function isPerkPermanent(perkId: string, permanentPerkIds: string[]): boolean {
  return permanentPerkIds.includes(perkId);
}

// ---------------------------------------------------------------------------
// Benefits
// ---------------------------------------------------------------------------

/** Extract displayable benefit entries from a perk's effects. */
export function getPerkBenefits(perk: PerkDefinition): PerkBenefit[] {
  const benefits: PerkBenefit[] = [];

  if (perk.effects.statBoosts) {
    Object.entries(perk.effects.statBoosts).forEach(([stat, value]) => {
      if (stat === 'money') {
        benefits.push({ stat: 'Starting Money', value, type: 'start' });
      } else {
        benefits.push({ stat, value, type: 'stat' });
      }
    });
  }

  if (perk.effects.incomeMultiplier && perk.effects.incomeMultiplier > 1) {
    const percentage = Math.round((perk.effects.incomeMultiplier - 1) * 100);
    benefits.push({ stat: 'Income Boost', value: percentage, type: 'income' });
  }

  return benefits;
}

// ---------------------------------------------------------------------------
// Stat display helpers
// ---------------------------------------------------------------------------

/**
 * Map a stat name to its display color.
 *
 * Delegates to `lib/config/statIdentity.ts` - the pairings the HUD taught the
 * player. This function used to carry its OWN table, and it disagreed with the
 * HUD on the two stats a player looks at most: happiness was RED and energy was
 * AMBER, i.e. the HUD's colours on the wrong stats, shown on the onboarding
 * perk cards seconds before the player meets the HUD itself. The extra keys
 * below ('Starting Money', 'Income Boost') are perk-card labels rather than
 * stats, so they stay here.
 */
export function getStatColor(stat: string): string {
  switch (stat) {
    // Perk-card labels rather than stats - both are money effects, so they
    // wear money's identity colour instead of a bespoke orange/green that
    // disagreed with the wallet the HUD shows seconds later.
    case 'Starting Money':
    case 'Income Boost':
      return STAT_IDENTITY.money.color;
    default:
      return STAT_IDENTITY[stat]?.color ?? '#64748B';
  }
}

