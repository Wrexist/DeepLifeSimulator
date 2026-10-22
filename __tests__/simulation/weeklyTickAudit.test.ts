/**
 * Weekly-tick audit (2026-10-21) - regressions checked on the REAL tick.
 *
 * Each case was reproduced on the earlyGameSim harness before the fix:
 *
 *   TICK-2  a wedding scheduled on a week the partner was pregnant never
 *           happened - the pregnancy branch returned before the wedding gate,
 *           whose exact-week equality then never matched again.
 *   TICK-3  the death week restored the pre-tick wallet while keeping what that
 *           wallet had already funded, so $20k cash + a $15k savings-goal sweep
 *           came out as $20k cash AND a $15k goal.
 *   TICK-9  fitness decay measured "weeks since the gym" from week 0 of the
 *           absolute counter, so every age-20+ start paid the 9+-weeks x4 rate
 *           from its first tick.
 *   TICK-10 children skipped the relationship-health pass, so the documented
 *           child-neglect branch was unreachable.
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

/** A relationship added to the seeded life; fields beyond the base are per case. */
function person(fields: Partial<Relationship> & Pick<Relationship, 'id' | 'name' | 'type'>): Relationship {
  return {
    relationshipScore: 80,
    personality: 'kind',
    gender: 'female',
    age: 25,
    datesCount: 5,
    ...fields,
  } as Relationship;
}

describe('weekly tick audit - real tick', () => {
  it('TICK-2: a wedding scheduled during a pregnancy still happens on its week', async () => {
    let start = 0;
    const result = await runPersona({
      name: 'wedding during pregnancy',
      weeks: 4,
      seed: 1,
      scenarioId: 'food_courier',
      policy: () => {},
      mutateSeed: (s: GameState) => {
        const w = s.weeksLived || 0;
        start = w;
        const partner = person({
          id: 'p1',
          name: 'Pat',
          type: 'partner',
          engagementWeek: w - 1,
          isPregnant: true,
          pregnancyStartWeek: w - 1,
          weddingPlanned: {
            venueId: 'courthouse', venueName: 'Courthouse', venueType: 'courthouse', budget: 1000, guestCount: 10,
            scheduledWeek: w + 2, originalScheduledWeek: w + 2, partnerId: 'p1',
            catering: false, photography: false, music: false, decorations: false,
          },
        });
        return { ...s, stats: { ...s.stats, money: 50_000 }, relationships: [...(s.relationships || []), partner] };
      },
    });
    const p = (result.finalState.relationships || []).find((r) => r.id === 'p1');
    expect(result.finalState.weeksLived).toBeGreaterThan(start + 2);
    expect(p?.type).toBe('spouse');
    expect(p?.weddingPlanned).toBeUndefined();
    // Still pregnant: the wedding did not cost the pregnancy.
    expect(p?.isPregnant).toBe(true);
  });

  it('TICK-3: the death week takes back income without keeping what the old wallet funded', async () => {
    const result = await runPersona({
      name: 'death week transfers',
      weeks: 1,
      seed: 1,
      scenarioId: 'food_courier',
      policy: () => {},
      mutateSeed: (st: GameState) => ({
        ...st,
        weeksLived: st.weeksLived + 12,
        lifeStartWeek: st.weeksLived,
        stats: { ...st.stats, health: 0, happiness: 80, money: 20_000 },
        healthZeroWeeks: 3,
        banking: {
          ...st.banking!,
          savingsGoals: [{
            id: 'g1', name: 'G', targetAmount: 100_000, currentAmount: 0,
            category: 'other', createdWeek: 0, autoContribute: 15_000,
          }],
        } as GameState['banking'],
      }),
    });
    const s = result.finalState;
    expect(s.showDeathPopup).toBe(true);
    const goal = s.banking?.savingsGoals?.[0]?.currentAmount ?? 0;
    // Whatever the sweep moved, it came out of the $20k - nothing was minted.
    expect(s.stats.money + goal).toBeLessThanOrEqual(20_000);
  });

  it('TICK-9: an age-20+ start pays the base fitness decay on its first week, not x4', async () => {
    // Same life twice: once with no gym visit on record, once with a visit
    // stamped at the start of the life. Before the fix the first read
    // "105 weeks since the gym" and decayed at x4.
    const run = (stampVisit: boolean) =>
      runPersona({
        name: `fitness ${stampVisit ? 'stamped' : 'unset'}`,
        weeks: 1,
        seed: 2,
        scenarioId: 'food_courier',
        policy: () => {},
        mutateSeed: (st: GameState) => ({
          ...st,
          lifeStartWeek: st.weeksLived,
          stats: { ...st.stats, fitness: 60 },
          lastGymVisitWeek: stampVisit ? st.weeksLived : undefined,
        }),
      });
    const unset = await run(false);
    const stamped = await run(true);
    expect(unset.finalState.lifeStartWeek).toBeGreaterThan(0);
    expect(unset.finalState.stats.fitness).toBe(stamped.finalState.stats.fitness);
  });

  it('TICK-10: a neglected child reaches the relationship-health pass', async () => {
    const result = await runPersona({
      name: 'neglected child',
      weeks: 1,
      seed: 1,
      scenarioId: 'food_courier',
      policy: () => {},
      mutateSeed: (st: GameState) => ({
        ...st,
        relationships: [
          ...(st.relationships || []),
          person({ id: 'kid1', name: 'Sam', type: 'child', age: 8, relationshipScore: 10, datesCount: 0 }),
        ],
      }),
    });
    const kid = (result.finalState.relationships || []).find((r) => r.id === 'kid1');
    expect(kid).toBeDefined();
    // Aged by the child pass AND tracked by the neglect branch.
    expect(kid!.age).toBeGreaterThan(8);
    expect(kid!.weeksAtLowRelationship).toBe(1);
  });
});
