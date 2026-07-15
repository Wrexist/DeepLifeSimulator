/**
 * scorePlayerProfile — profile attractiveness scoring.
 *
 * Regression coverage for crash-on-old-save: a legacy `sparkApp` written
 * before the `premium`/`profile` sub-objects existed must not throw when
 * scored (the reads are optional-chained with safe defaults).
 */
import { scorePlayerProfile } from '@/lib/dating/sparkLogic';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, SparkAppState } from '@/contexts/game/types';

function cloneSpark(state: GameState): SparkAppState {
  return JSON.parse(JSON.stringify(state.sparkApp)) as SparkAppState;
}

describe('scorePlayerProfile', () => {
  it('returns 0 when Spark has never been initialized', () => {
    const state = createTestGameState({ sparkApp: undefined });
    expect(scorePlayerProfile(state)).toBe(0);
  });

  it('does not throw on a legacy save whose sparkApp lacks premium/profile', () => {
    // Simulate a pre-migration save: the sparkApp slice exists but the
    // `premium` and `profile` sub-objects were only added in a later version.
    const legacySpark = {
      swipesUsedThisWeek: 0,
      superLikesUsedThisWeek: 0,
    } as unknown as SparkAppState;
    const state = createTestGameState({
      sparkApp: legacySpark,
      stats: { reputation: 20, money: 1000 },
    });

    let score = NaN;
    expect(() => {
      score = scorePlayerProfile(state);
    }).not.toThrow();
    expect(typeof score).toBe('number');
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores a populated profile higher than an empty legacy one', () => {
    const legacySpark = {
      swipesUsedThisWeek: 0,
      superLikesUsedThisWeek: 0,
    } as unknown as SparkAppState;
    const legacyState = createTestGameState({
      sparkApp: legacySpark,
      stats: { reputation: 20, money: 1000 },
    });

    const fullState = createTestGameState({ stats: { reputation: 20, money: 1000 } });
    const sp = cloneSpark(fullState);
    sp.profile.photos = ['a.jpg', 'b.jpg', 'c.jpg'];
    sp.profile.bio = 'x'.repeat(120);
    sp.profile.interests = ['music', 'travel', 'coffee', 'hiking', 'code'];
    sp.premium.perks.verifiedBadge = true;
    fullState.sparkApp = sp;

    expect(scorePlayerProfile(fullState)).toBeGreaterThan(scorePlayerProfile(legacyState));
  });
});
