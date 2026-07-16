/**
 * Regression: one-time gem/prestige-point payouts must not be re-grantable every
 * prestige.
 *
 * Prestige RESETS per-life state (claimedProgressAchievements, ambition
 * milestone/claimed flags) but PRESERVES stats.gems and prestige.prestigePoints.
 * Two payouts were gated only on per-life state and could therefore be farmed
 * once per prestige cycle:
 *   1. Life Ambition payoff (gems + prestigePoints).
 *   2. Progress-achievement gem mint (covered in the achievementsFlow suite).
 *
 * The fix adds two cross-life stamps to PrestigeData — `claimedAmbitions` and
 * `claimedAchievementIds` — that are carried through `createResetGameState`.
 * This suite verifies (a) the ambition farm is closed, (c) first-ever claims
 * still grant, and (d) both stamps survive the reset.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { LIFE_AMBITIONS } from '@/lib/ambitions/catalog';
import {
  getAmbitionById,
  getAmbitionCompletion,
  grantAmbitionPayout,
} from '@/lib/ambitions/progress';
import type { GameState } from '@/contexts/game/types';

const AMBITION = 'amass_fortune';
const allMilestoneIds = LIFE_AMBITIONS.find((a) => a.id === AMBITION)!.milestones.map((m) => m.id);

/** A fully-completed-ambition state above the prestige threshold. */
function completedAmbitionState(): GameState {
  const s = createTestGameState({
    stats: { money: getPrestigeThreshold(0) + 5_000_000, gems: 100 },
    ambitionId: AMBITION,
    // Persisted milestone ids count as complete (milestones are sticky), so the
    // ambition reads readyToClaim regardless of the underlying predicates.
    ambitionCompletedMilestones: [...allMilestoneIds],
  });
  // Fresh prestige object so we can seed a pre-existing achievement stamp without
  // mutating the shared defaultPrestigeData reference.
  s.prestige = { ...s.prestige!, claimedAmbitions: [], claimedAchievementIds: ['seed_achievement'] };
  return s;
}

describe('one-time payout preservation across prestige', () => {
  it('(c) first-ever ambition fulfillment grants gems + prestige points and stamps the id', () => {
    const s0 = completedAmbitionState();
    const payoff = getAmbitionById(AMBITION)!.payoff;

    expect(getAmbitionCompletion(s0)!.readyToClaim).toBe(true);

    const s1 = grantAmbitionPayout(s0);
    expect(s1.stats.gems).toBe(100 + (payoff.gems ?? 0));
    expect(s1.prestige!.prestigePoints).toBe((s0.prestige!.prestigePoints ?? 0) + (payoff.prestigePoints ?? 0));
    expect(s1.prestige!.claimedAmbitions).toContain(AMBITION);
    expect(s1.ambitionRewardClaimed).toBe(true);
  });

  it('(d) createResetGameState preserves claimedAmbitions and claimedAchievementIds', () => {
    const claimed = grantAmbitionPayout(completedAmbitionState());
    const next = executePrestige(claimed, 'reset');

    // Reset happened (fresh life at 18) but the cross-life stamps survived.
    expect(next.date.age).toBe(18);
    expect(next.prestige!.claimedAmbitions).toContain(AMBITION);
    expect(next.prestige!.claimedAchievementIds).toContain('seed_achievement');
    // Per-life ambition flags were wiped (fresh run of the same ambition).
    expect(next.ambitionRewardClaimed).toBeFalsy();
    expect(next.ambitionCompletedMilestones ?? []).toEqual([]);
  });

  it('(a) re-completing the same ambition after prestige grants NO gems / prestige points again', () => {
    const claimed = grantAmbitionPayout(completedAmbitionState());
    const next = executePrestige(claimed, 'reset');

    const gemsAfterPrestige = next.stats.gems;
    const ppAfterPrestige = next.prestige!.prestigePoints;

    // Re-fulfil the same ambition in the new life.
    const relived: GameState = {
      ...next,
      ambitionId: AMBITION,
      ambitionCompletedMilestones: [...allMilestoneIds],
    };

    const c = getAmbitionCompletion(relived)!;
    expect(c.alreadyClaimed).toBe(true); // cross-life stamp reflected in the UI
    expect(c.readyToClaim).toBe(false);

    const reclaimed = grantAmbitionPayout(relived);
    expect(reclaimed.stats.gems).toBe(gemsAfterPrestige); // no new gems
    expect(reclaimed.prestige!.prestigePoints).toBe(ppAfterPrestige); // no new prestige points
  });
});
