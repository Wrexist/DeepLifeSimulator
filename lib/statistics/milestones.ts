/**
 * Milestones — derive notable life events from raw state.
 *
 * Different from achievements (which are a separate explicit registry).
 * Milestones are dashboard celebrations that surface when the player crosses
 * specific thresholds: first $1M, first viral video, first house, etc.
 *
 * Pure functions.
 */

import { GameState } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface Milestone {
  id: string;
  label: string;
  /** Free-form sub label — e.g. "Week 142" or "Beauty Contest". */
  context?: string;
  /** Optional category tag for grouping. */
  category: 'wealth' | 'career' | 'social' | 'creative' | 'risk' | 'family';
  /** Sortable timestamp / week for ordering. */
  week?: number;
}

export function buildMilestones(state: GameState): Milestone[] {
  const out: Milestone[] = [];
  const stats = state.lifetimeStatistics;

  if (safe(stats?.peakNetWorth, 0) >= 1_000_000) {
    out.push({
      id: 'first-million',
      label: 'First $1M net worth',
      context: stats?.peakNetWorthWeek ? `Week ${stats.peakNetWorthWeek}` : undefined,
      category: 'wealth',
      week: stats?.peakNetWorthWeek,
    });
  }
  if (safe(stats?.peakNetWorth, 0) >= 10_000_000) {
    out.push({
      id: 'first-ten-million',
      label: 'First $10M net worth',
      context: stats?.peakNetWorthWeek ? `Week ${stats.peakNetWorthWeek}` : undefined,
      category: 'wealth',
      week: stats?.peakNetWorthWeek,
    });
  }
  if (safe(stats?.totalPropertiesOwned, 0) > 0) {
    out.push({
      id: 'first-property',
      label: `Owned ${stats!.totalPropertiesOwned} property(s)`,
      category: 'wealth',
    });
  }
  if (safe(stats?.totalCompaniesOwned, 0) > 0) {
    out.push({
      id: 'first-company',
      label: `Founded ${stats!.totalCompaniesOwned} company(s)`,
      category: 'career',
    });
  }
  if (safe(stats?.totalChildren, 0) > 0) {
    out.push({
      id: 'parent',
      label: `Parent to ${stats!.totalChildren}`,
      category: 'family',
    });
  }
  if (safe(stats?.totalTravelDestinations, 0) >= 5) {
    out.push({
      id: 'world-traveler',
      label: `Visited ${stats!.totalTravelDestinations} destinations`,
      category: 'social',
    });
  }
  if (safe(stats?.totalViralPosts, 0) > 0) {
    out.push({
      id: 'viral',
      label: `${stats!.totalViralPosts} viral post(s)`,
      category: 'creative',
    });
  }
  if (safe(stats?.totalCrimesCommitted, 0) >= 10) {
    out.push({
      id: 'underworld',
      label: `${stats!.totalCrimesCommitted} crimes committed`,
      category: 'risk',
    });
  }
  if (safe(stats?.totalJailTime, 0) > 0) {
    out.push({
      id: 'jail',
      label: `${stats!.totalJailTime} weeks served`,
      category: 'risk',
    });
  }

  // Cross-system milestones that the old `lifetimeStatistics` ignored.
  const channel = state.gamingStreaming;
  if (safe(channel?.subscribers, 0) >= 1_000) {
    out.push({
      id: 'creator-1k',
      label: '1k+ subscribers',
      category: 'creative',
    });
  }
  if (safe(channel?.subscribers, 0) >= 100_000) {
    out.push({
      id: 'creator-100k',
      label: 'Six-figure subscriber count',
      category: 'creative',
    });
  }

  const pol = state.politics;
  if (safe(pol?.electionsWon, 0) > 0) {
    out.push({
      id: 'elected',
      label: `Won ${pol?.electionsWon} election(s)`,
      category: 'career',
    });
  }

  const dw = state.darkWeb;
  if (((dw?.jobHistory ?? []).length) >= 10) {
    out.push({
      id: 'fence',
      label: `${(dw?.jobHistory ?? []).length} dark-web jobs`,
      category: 'risk',
    });
  }

  const pets = state.pets ?? [];
  if (pets.length > 0) {
    out.push({
      id: 'pets',
      label: `${pets.length} pet(s) owned in lifetime`,
      category: 'family',
    });
  }

  // Sort: weeks present first (chronological), then unweeked alphabetically.
  return out.sort((a, b) => {
    if (a.week !== undefined && b.week !== undefined) return a.week - b.week;
    if (a.week !== undefined) return -1;
    if (b.week !== undefined) return 1;
    return a.label.localeCompare(b.label);
  });
}

// ---------------------------------------------------------------------------
// Milestone rewards — a small ONE-TIME gem grant per milestone the first time
// it is claimed. Milestones were display-only; this makes crossing a threshold
// pay out modestly (5–15 gems by category tier). Once-ever per milestone id,
// gated by the additive `claimedMilestoneRewards` set, granted via the canonical
// clamped gems path (mirrors lib/ambitions/progress + prestige).
// ---------------------------------------------------------------------------

/** JS-safe cap, mirrors MONEY_CEILING / the gems clamp used elsewhere. */
const GEM_CEILING = Number.MAX_SAFE_INTEGER;

/** Gems awarded for reaching a milestone, by category tier (modest, 5–15). */
export function milestoneGemReward(milestone: Pick<Milestone, 'category'>): number {
  switch (milestone.category) {
    case 'wealth': return 15; // hardest to reach
    case 'career': return 12;
    case 'creative': return 10;
    case 'risk': return 10;
    case 'social': return 8;
    case 'family': return 8;
    default: return 5;
  }
}

/** Ids of milestones whose gem reward has already been claimed (additive set). */
export function getClaimedMilestoneRewards(state: GameState): string[] {
  return Array.isArray(state.claimedMilestoneRewards) ? state.claimedMilestoneRewards : [];
}

/** True when `milestoneId` is currently reached AND its reward is unclaimed. */
export function isMilestoneClaimable(state: GameState, milestoneId: string): boolean {
  if (getClaimedMilestoneRewards(state).includes(milestoneId)) return false;
  return buildMilestones(state).some((m) => m.id === milestoneId);
}

export interface MilestoneClaimResult {
  ok: boolean;
  /** New state (SAME reference when nothing changed). */
  state: GameState;
  /** Gems granted (0 when already claimed or not yet reached). */
  granted: number;
}

/**
 * Claim the one-time gem reward for a REACHED milestone. Pure + idempotent:
 * returns the same state reference (and `granted: 0`) when the milestone is
 * already claimed or not currently reached, so a double-tap can't double-grant.
 * On success it records the id in `claimedMilestoneRewards` and adds the reward
 * to `stats.gems` (clamped).
 */
export function claimMilestoneReward(state: GameState, milestoneId: string): MilestoneClaimResult {
  const claimed = getClaimedMilestoneRewards(state);
  if (claimed.includes(milestoneId)) return { ok: false, state, granted: 0 };
  const milestone = buildMilestones(state).find((m) => m.id === milestoneId);
  if (!milestone) return { ok: false, state, granted: 0 };
  const reward = milestoneGemReward(milestone);
  const gems = Math.min(GEM_CEILING, safe(state.stats?.gems, 0) + reward);
  return {
    ok: true,
    granted: reward,
    state: {
      ...state,
      stats: { ...state.stats, gems },
      claimedMilestoneRewards: [...claimed, milestoneId],
    },
  };
}
