/**
 * Perk selection logic for the onboarding Perks screen.
 *
 * Extracted from Perks.tsx — pure functions for sorting, locking, and benefit display.
 */

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

interface Achievement {
  id: string;
  completed?: boolean;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Sort perks: unlocked first, then by rarity within each group. */
export function sortPerksByUnlockStatus(
  perksList: PerkDefinition[],
  permanentPerkIds: string[],
  achievements: Achievement[]
): PerkDefinition[] {
  return [...perksList].sort((a, b) => {
    const aUnlocked = isPerkUnlocked(a, permanentPerkIds, achievements);
    const bUnlocked = isPerkUnlocked(b, permanentPerkIds, achievements);

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

/** A perk is unlocked if it has no requirement, is permanent, or its achievement is done. */
export function isPerkUnlocked(
  perk: PerkDefinition,
  permanentPerkIds: string[],
  achievements: Achievement[]
): boolean {
  if (!perk.unlock) return true;
  if (permanentPerkIds.includes(perk.id)) return true;
  return !!achievements.find((a) => a.id === perk.unlock?.achievementId)?.completed;
}

/** A perk is locked if it has an unlock requirement AND is not permanent AND its achievement is incomplete. */
export function isPerkLocked(
  perk: PerkDefinition,
  permanentPerkIds: string[],
  achievements: Achievement[]
): boolean {
  return !isPerkUnlocked(perk, permanentPerkIds, achievements);
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

/** Map a stat name to its display color. */
export function getStatColor(stat: string): string {
  switch (stat) {
    case 'happiness':
      return '#EF4444';
    case 'health':
      return '#10B981';
    case 'energy':
      return '#F59E0B';
    case 'fitness':
      return '#3B82F6';
    case 'reputation':
      return '#8B5CF6';
    case 'money':
    case 'Starting Money':
      return '#F7931A';
    case 'Income Boost':
      return '#10B981';
    default:
      return '#6B7280';
  }
}

/**
 * Map a stat name to a lucide icon name.
 * Returns the icon name string — the component must resolve it.
 */
export function getStatIconName(stat: string): string {
  switch (stat) {
    case 'happiness':
      return 'Heart';
    case 'health':
      return 'Shield';
    case 'energy':
      return 'Zap';
    case 'fitness':
    case 'Income Boost':
      return 'TrendingUp';
    case 'reputation':
      return 'Users';
    case 'money':
    case 'Starting Money':
      return 'DollarSign';
    default:
      return 'TrendingUp';
  }
}
