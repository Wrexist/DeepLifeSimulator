/**
 * LIFE-13 (owner decision 2026-10-22): the commitment stat bonus and the
 * neglect penalty are applied once a week.
 */
import { applyCommitmentStats } from '../applyCommitmentStats';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  COMMITMENT_NEGLECT_HAPPINESS,
  COMMITMENT_REPUTATION_TARGET_MAX,
  weeklyCommitmentStatEffects,
} from '@/lib/commitments/commitmentSystem';
import type { GameState, GameStats } from '@/contexts/game/types';

type Commitments = NonNullable<GameState['activityCommitments']>;
const commit = (over: Partial<Commitments>): Commitments => ({
  ...createTestGameState().activityCommitments!,
  ...over,
});
const stats = (happiness: number, reputation: number): GameStats => ({
  ...createTestGameState().stats,
  happiness,
  reputation,
});

describe('LIFE-13: weekly commitment stat effects', () => {
  it('no focus picked costs nothing and grants nothing', () => {
    const ctx = { newStats: stats(60, 10) };
    applyCommitmentStats(commit({ primary: undefined, secondary: undefined }), ctx);
    expect(ctx.newStats.happiness).toBe(60);
    expect(ctx.newStats.reputation).toBe(10);
  });

  it('each neglected area costs 1 happiness a week', () => {
    const both = commit({ primary: 'career', secondary: 'health' });
    expect(weeklyCommitmentStatEffects({ activityCommitments: both }).happiness).toBe(2 * COMMITMENT_NEGLECT_HAPPINESS);
    const one = commit({ primary: 'career', secondary: undefined });
    expect(weeklyCommitmentStatEffects({ activityCommitments: one }).happiness).toBe(3 * COMMITMENT_NEGLECT_HAPPINESS);
    const ctx = { newStats: stats(60, 0) };
    applyCommitmentStats(both, ctx);
    expect(ctx.newStats.happiness).toBe(58);
  });

  it('never drives happiness below 0', () => {
    const ctx = { newStats: stats(1, 0) };
    applyCommitmentStats(commit({ primary: 'career' }), ctx);
    expect(ctx.newStats.happiness).toBe(0);
  });

  it('a primary focus nudges reputation +1/wk toward floor(level/5), never down', () => {
    const levels = { career: 100, hobbies: 0, relationships: 0, health: 0 };
    const c = commit({ primary: 'career', secondary: 'health', commitmentLevels: levels });
    let rep = 0;
    for (let w = 0; w < 60; w++) {
      const ctx = { newStats: stats(80, rep) };
      applyCommitmentStats(c, ctx);
      rep = ctx.newStats.reputation;
    }
    expect(rep).toBe(COMMITMENT_REPUTATION_TARGET_MAX);

    const high = { newStats: stats(80, 70) };
    applyCommitmentStats(c, high);
    expect(high.newStats.reputation).toBe(70);

    const low = commit({ primary: 'career', commitmentLevels: { ...levels, career: 40 } });
    expect(weeklyCommitmentStatEffects({ activityCommitments: low }).reputationTarget).toBe(8);
  });

  it('degrades corrupt stats instead of writing NaN', () => {
    const ctx = { newStats: stats(NaN, NaN) };
    applyCommitmentStats(commit({ primary: 'career', commitmentLevels: { career: 50, hobbies: 0, relationships: 0, health: 0 } }), ctx);
    expect(ctx.newStats.happiness).toBe(0);
    expect(ctx.newStats.reputation).toBe(1);
  });
});
