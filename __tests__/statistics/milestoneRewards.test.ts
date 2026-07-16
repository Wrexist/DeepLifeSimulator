/**
 * Statistics milestones now pay a modest one-time gem reward the first time they
 * are claimed (they used to be display-only). The reward is once-ever per
 * milestone id (additive `claimedMilestoneRewards` set) and granted via the
 * canonical clamped gems path.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import {
  buildMilestones,
  milestoneGemReward,
  claimMilestoneReward,
  isMilestoneClaimable,
  getClaimedMilestoneRewards,
} from '@/lib/statistics/milestones';

/** State where the "first $1M net worth" (wealth, 15💎) milestone is reached. */
const millionaireState = (gems = 0, extra: Partial<GameState> = {}): GameState =>
  createTestGameState({
    stats: { ...createTestGameState().stats, gems },
    lifetimeStatistics: {
      ...createTestGameState().lifetimeStatistics,
      peakNetWorth: 2_000_000,
      peakNetWorthWeek: 100,
    },
    ...extra,
  } as Partial<GameState>);

describe('milestoneGemReward', () => {
  it('is a modest 5–15 gems for every category', () => {
    const cats = ['wealth', 'career', 'creative', 'risk', 'social', 'family'] as const;
    for (const category of cats) {
      const r = milestoneGemReward({ category });
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThanOrEqual(15);
    }
    expect(milestoneGemReward({ category: 'wealth' })).toBe(15);
  });
});

describe('claimMilestoneReward', () => {
  it('grants the reward once and records the claim', () => {
    const s = millionaireState(3);
    expect(buildMilestones(s).some((m) => m.id === 'first-million')).toBe(true);
    expect(isMilestoneClaimable(s, 'first-million')).toBe(true);

    const res = claimMilestoneReward(s, 'first-million');
    expect(res.ok).toBe(true);
    expect(res.granted).toBe(15);
    expect(res.state.stats.gems).toBe(3 + 15);
    expect(getClaimedMilestoneRewards(res.state)).toContain('first-million');
    expect(isMilestoneClaimable(res.state, 'first-million')).toBe(false);
  });

  it('is once-ever — a second claim is a no-op (no double-grant)', () => {
    const s = millionaireState(0);
    const once = claimMilestoneReward(s, 'first-million');
    const twice = claimMilestoneReward(once.state, 'first-million');
    expect(twice.ok).toBe(false);
    expect(twice.granted).toBe(0);
    expect(twice.state).toBe(once.state); // same reference — nothing changed
    expect(twice.state.stats.gems).toBe(15); // still just the one grant
  });

  it('refuses to pay a milestone that is not actually reached', () => {
    const s = millionaireState(5);
    const res = claimMilestoneReward(s, 'first-ten-million'); // 2M < 10M → not reached
    expect(res.ok).toBe(false);
    expect(res.granted).toBe(0);
    expect(res.state).toBe(s);
    expect(res.state.stats.gems).toBe(5);
  });

  it('does not mutate the input state', () => {
    const s = millionaireState(0);
    claimMilestoneReward(s, 'first-million');
    expect(s.stats.gems).toBe(0);
    expect(getClaimedMilestoneRewards(s)).toEqual([]);
  });
});
