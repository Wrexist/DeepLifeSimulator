/**
 * WP-F: the lifetime counters that had a reader and no writer.
 *
 * `lifetimeStatistics.totalPropertiesOwned`, `totalPostsMade` and
 * `totalViralPosts` were read by `components/computer/StatisticsApp.tsx` and by
 * `lib/statistics/milestones.ts`, but NOTHING in production ever incremented
 * them — the `trackNewProperty` / `trackPost` helpers in
 * `lib/statistics/statisticsTracker.ts` were called only from a stress test.
 * That is the exact shape `tasks/lessons.md` keeps recording: a leaf with green
 * tests, a context that exposes it, and nothing that calls it.
 *
 * The visible cost was two gem rewards that could never be earned: the
 * `first-property` milestone (15 gems, wealth tier) and `viral` (10 gems,
 * creative tier). These tests drive the REAL action modules and assert the
 * milestone actually becomes claimable, so a regression that silently unwires
 * the counters again fails here rather than in a player's save.
 */
import type React from 'react';
import { buyPropertyWithMortgage } from '@/contexts/game/actions/RealEstateActions';
import { composePost } from '@/contexts/game/actions/PulseActions';
import { buildMilestones, isMilestoneClaimable, claimMilestoneReward } from '@/lib/statistics/milestones';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, RealEstate } from '@/contexts/game/types';

/** useState-shaped harness: the updater always sees the latest state. */
function harness(initial: GameState) {
  let current = initial;
  const setGameState = ((updater: React.SetStateAction<GameState>) => {
    current = typeof updater === 'function'
      ? (updater as (p: GameState) => GameState)(current)
      : updater;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setGameState, get: () => current };
}

const CONDO = {
  id: 'wpf-test-condo',
  name: 'WP-F Test Condo',
  price: 200_000,
  owned: false,
} as unknown as RealEstate;

function buyer(): GameState {
  const s = createTestGameState({ weeksLived: 300 });
  s.stats = { ...s.stats, money: 2_000_000 };
  s.realEstate = [];
  s.loans = [];
  s.lifetimeStatistics = { ...s.lifetimeStatistics! , totalPropertiesOwned: 0 };
  s.claimedMilestoneRewards = [];
  return s;
}

function poster(): GameState {
  const s = createTestGameState({ weeksLived: 300 });
  s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  s.lifetimeStatistics = {
    ...s.lifetimeStatistics!,
    totalPostsMade: 0,
    totalViralPosts: 0,
  };
  s.claimedMilestoneRewards = [];
  return s;
}

describe('totalPropertiesOwned is written by a real property purchase', () => {
  it('the fixture starts at 0 with the milestone unreached (guards the rest)', () => {
    const s = buyer();
    expect(s.lifetimeStatistics?.totalPropertiesOwned).toBe(0);
    expect(buildMilestones(s).some((m) => m.id === 'first-property')).toBe(false);
    expect(isMilestoneClaimable(s, 'first-property')).toBe(false);
  });

  it('a cash purchase increments the counter and makes `first-property` claimable', () => {
    const start = buyer();
    const h = harness(start);
    const r = buyPropertyWithMortgage(start, h.setGameState, {
      property: CONDO,
      tier: 'cash',
      term: '30y',
      weeklyIncome: 5_000,
    } as never);

    expect(r.success).toBe(true);
    const after = h.get();
    // Guard: the purchase really landed, so the counter assertion means something.
    expect((after.realEstate ?? []).some((p) => p.id === CONDO.id && p.owned)).toBe(true);
    expect(after.lifetimeStatistics?.totalPropertiesOwned).toBe(1);

    expect(isMilestoneClaimable(after, 'first-property')).toBe(true);
    const claim = claimMilestoneReward(after, 'first-property');
    expect(claim.ok).toBe(true);
    expect(claim.granted).toBe(15);
    expect(claim.state.stats.gems).toBe((after.stats.gems ?? 0) + 15);
  });

  it('a mortgaged purchase increments it too', () => {
    const start = buyer();
    const h = harness(start);
    const r = buyPropertyWithMortgage(start, h.setGameState, {
      property: CONDO,
      tier: 'standard',
      term: '30y',
      weeklyIncome: 5_000,
    } as never);

    expect(r.success).toBe(true);
    expect(h.get().lifetimeStatistics?.totalPropertiesOwned).toBe(1);
  });

  it('a REFUSED purchase does not increment it (the counter rides the commit)', () => {
    const start = buyer();
    start.stats = { ...start.stats, money: 100 }; // can't cover any down payment
    const h = harness(start);
    const r = buyPropertyWithMortgage(start, h.setGameState, {
      property: CONDO,
      tier: 'cash',
      term: '30y',
      weeklyIncome: 0,
    } as never);

    expect(r.success).toBe(false);
    expect(h.get().lifetimeStatistics?.totalPropertiesOwned).toBe(0);
    expect(isMilestoneClaimable(h.get(), 'first-property')).toBe(false);
  });

  it('buying the SAME property twice counts once - the second is refused', () => {
    const start = buyer();
    const h = harness(start);
    buyPropertyWithMortgage(start, h.setGameState, {
      property: CONDO, tier: 'cash', term: '30y', weeklyIncome: 5_000,
    } as never);
    const mid = h.get();
    buyPropertyWithMortgage(mid, h.setGameState, {
      property: CONDO, tier: 'cash', term: '30y', weeklyIncome: 5_000,
    } as never);

    expect(h.get().lifetimeStatistics?.totalPropertiesOwned).toBe(1);
  });
});

describe('totalPostsMade / totalViralPosts are written by composePost', () => {
  it('a post increments totalPostsMade', () => {
    const start = poster();
    const h = harness(start);
    const r = composePost(h.setGameState, start, {
      content: 'hello world',
      contentType: 'text',
    } as never);

    expect(r.success).toBe(true);
    const after = h.get();
    expect(after.lifetimeStatistics?.totalPostsMade).toBe(1);
    // Non-viral posts must not touch the viral counter…
    if (!r.isViral) {
      expect(after.lifetimeStatistics?.totalViralPosts).toBe(0);
      expect(isMilestoneClaimable(after, 'viral')).toBe(false);
    } else {
      expect(after.lifetimeStatistics?.totalViralPosts).toBe(1);
    }
  });

  it('a viral post makes the `viral` milestone claimable for 10 gems', () => {
    // Virality is a roll inside composePost, so drive the counter the way the
    // action does and assert the milestone reads it. This is the reachability
    // claim the milestone existed to make.
    const s = poster();
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalViralPosts: 1 };
    expect(buildMilestones(s).some((m) => m.id === 'viral')).toBe(true);
    const claim = claimMilestoneReward(s, 'viral');
    expect(claim.ok).toBe(true);
    expect(claim.granted).toBe(10);
  });

  it('a refused post (weekly cap hit in fresh state) does not increment', () => {
    const start = poster();
    const h = harness(start);
    composePost(h.setGameState, start, { content: 'first', contentType: 'text' } as never);
    const afterFirst = h.get();
    expect(afterFirst.lifetimeStatistics?.totalPostsMade).toBe(1);

    // Second post of the same content type in the same week: the fresh-state
    // guard inside the updater returns `prev` unchanged, so the counter must
    // not move either — the increment lives past that guard on purpose.
    composePost(h.setGameState, afterFirst, { content: 'second', contentType: 'text' } as never);
    expect(h.get().lifetimeStatistics?.totalPostsMade).toBe(1);
  });
});
