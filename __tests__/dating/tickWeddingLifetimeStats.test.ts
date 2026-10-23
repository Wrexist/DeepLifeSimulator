/**
 * SOC2-2 - a wedding the weekly tick executes is counted on Spark's record.
 *
 * A booked wedding is executed by the tick (`applyScheduledWedding`) on the
 * week it falls due. `executeWedding` - the only place that bumped
 * `sparkApp.lifetimeStats.totalMarriages` - requires `weeksLived >=
 * scheduledWeek`, which is only ever true AFTER the tick has already married
 * the couple, so in real play the Spark profile read "Marriages 0" for every
 * married player. Checked on the real tick (earlyGameSim), not a stub.
 */
import { runPersona } from '../helpers/earlyGameSim';
import type { GameState, Relationship } from '@/contexts/game/types';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

jest.setTimeout(300_000);

describe('SOC2-2: tick-executed wedding', () => {
  it('bumps Spark totalMarriages exactly once', async () => {
    let before = -1;
    const result = await runPersona({
      name: 'tick wedding counts',
      weeks: 4,
      seed: 3,
      scenarioId: 'food_courier',
      policy: () => {},
      mutateSeed: (s: GameState) => {
        const w = s.weeksLived || 0;
        before = s.sparkApp?.lifetimeStats?.totalMarriages ?? 0;
        const partner = {
          id: 'p1',
          name: 'Pat',
          type: 'partner',
          relationshipScore: 85,
          personality: 'kind',
          gender: 'female',
          age: 25,
          datesCount: 5,
          livingTogether: true,
          engagementWeek: w - 1,
          weddingPlanned: {
            venueId: 'courthouse', venueName: 'Courthouse', venueType: 'courthouse', budget: 1000, guestCount: 10,
            scheduledWeek: w + 2, originalScheduledWeek: w + 2, partnerId: 'p1',
            catering: false, photography: false, music: false, decorations: false,
          },
        } as Relationship;
        return { ...s, stats: { ...s.stats, money: 50_000 }, relationships: [...(s.relationships || []), partner] };
      },
    });
    const p = (result.finalState.relationships || []).find((r) => r.id === 'p1');
    expect(p?.type).toBe('spouse');
    expect(before).toBeGreaterThanOrEqual(0);
    expect(result.finalState.sparkApp?.lifetimeStats?.totalMarriages).toBe(before + 1);
  });
});
