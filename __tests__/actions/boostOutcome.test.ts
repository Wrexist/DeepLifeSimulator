/**
 * APP-5 (audit 2026-10-21): a boost the updater refuses must not be reported
 * as bought. Both outer checks used to test gems only and return success while
 * the updater returned `prev`.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import { boostProfile, activeBoostExpiresWeek } from '@/contexts/game/actions/SparkActions';
import { boostPostWithGems } from '@/contexts/game/actions/PulseActions';

describe('boost outcomes (APP-5)', () => {
  it('a second Spark boost while one is running reports failure and charges nothing', () => {
    const stub = createSetGameStateStub(createTestGameState({ weeksLived: 100, stats: { gems: 500 } }));
    expect(boostProfile(stub.setGameState, stub.current()).success).toBe(true);
    const afterFirst = stub.current();
    expect(activeBoostExpiresWeek(afterFirst)).toBeGreaterThan(100);
    const second = boostProfile(stub.setGameState, afterFirst);
    expect(second.success).toBe(false);
    expect(stub.current().stats.gems).toBe(afterFirst.stats.gems);
  });

  it('a second Pulse boost of the same post this week reports failure', () => {
    const base = createTestGameState({ weeksLived: 100, stats: { gems: 1_000 } });
    const stub = createSetGameStateStub(createTestGameState({
      weeksLived: 100,
      stats: { gems: 1_000 },
      socialMedia: { ...base.socialMedia!, pendingBoosts: [{ type: 'post', postId: 'p1', appliedWeek: 100 }] },
    }));
    const r = boostPostWithGems(stub.setGameState, stub.current(), 'p1', 200);
    expect(r.success).toBe(false);
    expect(stub.current().stats.gems).toBe(1_000);
  });
});
