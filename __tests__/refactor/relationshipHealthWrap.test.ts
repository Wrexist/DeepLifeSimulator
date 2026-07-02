/**
 * Weekly-audit regression (2026-07-02): relationships BEYOND the pre-roll length
 * must still be able to break up / be disappointed.
 *
 * The weekly tick maps over the FULL relationships array (parents, children,
 * friends, partners — uncapped), so `relIdx` can exceed the length-20
 * `relBreakup` / `relDisappointed` pre-roll buffers on a long, relationship-heavy
 * save. Before the fix the consumer indexed `preRolls.relBreakup[relIdx]`
 * directly, yielding `undefined` past the end — and `undefined < chance` is
 * `false`, silently making a low-scoring partner/spouse past index 20 immune to
 * breakup and disappointment. The consumer now wraps the index modulo the buffer
 * length (matching the pet / vehicle / disease consumers).
 */
import { applyRelationshipHealth } from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import type { GameStats } from '@/contexts/game/types';

function stubCtx(relBreakup: number[], relDisappointed: number[]): WeekContext {
  return {
    newStats: {} as GameStats,
    notifications: [] as WeekNotification[],
    preRolls: {
      careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
      childIdSuffix: 'x', childPersonality: 0,
      relBreakup, relDisappointed,
      policeEncounter: 0, minerDegradation: 0,
      diseaseComplication: [], diseaseProgression: [],
      petSickness: [], petSicknessType: [],
      vehicleAccident: [], vehicleAccidentSeverity: [],
      timestamp: 0,
    },
    nextWeeksLived: 100,
  } as WeekContext;
}

const lowSpouse = {
  id: 'r21', name: 'Alex', type: 'spouse' as const,
  relationshipScore: 10, weeksAtLowRelationship: 1,
};

describe('applyRelationshipHealth — pre-roll index wrap', () => {
  it('a spouse past the pre-roll length (idx 21) can still break up (not immune)', () => {
    // Buffers length 20; idx 21 wraps to [21 % 20] = [1]. Guarantee a breakup there.
    const relBreakup = Array.from({ length: 20 }, () => 0.9);
    relBreakup[1] = 0; // 0 < breakupChance(0.2) → breakup
    const ctx = stubCtx(relBreakup, Array.from({ length: 20 }, () => 0.9));

    const result = applyRelationshipHealth(lowSpouse as never, 21, ctx);

    expect(result.rel).toBeNull(); // broke up — pre-fix it read undefined and survived
    expect(ctx.notifications.some(n => n.id === 'relationship-breakup')).toBe(true);
  });

  it('a spouse past the buffer can still become disappointed (idx 21 wrap)', () => {
    const relDisappointed = Array.from({ length: 20 }, () => 0.9);
    relDisappointed[1] = 0; // 0 < 0.3 → disappointed
    const ctx = stubCtx(Array.from({ length: 20 }, () => 0.9), relDisappointed);

    const result = applyRelationshipHealth(lowSpouse as never, 21, ctx);

    expect(result.rel).not.toBeNull();
    expect(result.rel?.relationshipScore).toBeLessThan(lowSpouse.relationshipScore);
    expect(ctx.notifications.some(n => n.id === 'relationship-disappointed')).toBe(true);
  });

  it('a high draw past the buffer leaves the relationship intact', () => {
    const ctx = stubCtx(Array.from({ length: 20 }, () => 0.9), Array.from({ length: 20 }, () => 0.9));
    const result = applyRelationshipHealth(lowSpouse as never, 21, ctx);
    expect(result.rel).not.toBeNull();
  });
});
