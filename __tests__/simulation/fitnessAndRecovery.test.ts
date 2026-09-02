/**
 * Fitness brackets and the recovery loop on the real tick — Master Program 8.
 */
import { runPersona, seedScenario, withStartingAge, type SimPolicy } from '../helpers/earlyGameSim';
import { PERSONAS } from '../helpers/earlyGamePersonas';

/**
 * The careful player who also sees the doctor once a month while anything is
 * wrong - the "managed care" loop the chronic-condition copy describes.
 */
const carefulManaged = (): SimPolicy => {
  const careful = PERSONAS['C careful']();
  return async (ctx) => {
    await careful(ctx);
    const s = ctx.state();
    if ((s.diseases ?? []).length > 0 && s.stats.money >= 500 && ctx.week % 4 === 0) {
      await ctx.actions.performHealthActivity('doctor');
      ctx.note('doctor');
    }
  };
};

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

jest.setTimeout(900_000);

const pastGrace = (s: ReturnType<typeof seedScenario>) => ({
  ...s,
  weeksLived: s.weeksLived + 12,
  lifeStartWeek: s.weeksLived,
  lineageId: 'life_fitness',
  lastDiseaseWeek: s.weeksLived + 12,
  stats: { ...s.stats, fitness: 50 },
});

describe('fitness decay brackets', () => {
  it('a workout THIS week is charged the base rate; a week without one is charged more', async () => {
    const trained = await runPersona({
      name: 'trained', scenarioId: 'food_courier', seed: 1, weeks: 1, policy: () => undefined,
      mutateSeed: (s) => ({ ...pastGrace(s), lastGymVisitWeek: s.weeksLived + 12 }),
    });
    const skipped = await runPersona({
      name: 'skipped', scenarioId: 'food_courier', seed: 1, weeks: 1, policy: () => undefined,
      mutateSeed: (s) => ({ ...pastGrace(s), lastGymVisitWeek: s.weeksLived + 11 }),
    });
    const lapsed = await runPersona({
      name: 'lapsed', scenarioId: 'food_courier', seed: 1, weeks: 1, policy: () => undefined,
      mutateSeed: (s) => ({ ...pastGrace(s), lastGymVisitWeek: s.weeksLived }),
    });
    // Unrounded: the row rounds to whole points and 0.8 vs 1.2 both read as 1.
    const lossTrained = 50 - trained.finalState.stats.fitness;
    const lossSkipped = 50 - skipped.finalState.stats.fitness;
    const lossLapsed = 50 - lapsed.finalState.stats.fitness;
    // Base 4 × 0.2 = 0.8 at the base bracket; ×1.5 after one missed week; ×4 after nine.
    expect(lossTrained).toBeGreaterThan(0);
    expect(lossSkipped).toBeGreaterThan(lossTrained);
    expect(lossLapsed).toBeGreaterThan(lossSkipped);
    expect(lossTrained).toBeLessThanOrEqual(1);
  });

  it('a free walk builds fitness, so a fresh life is not stuck at zero', async () => {
    const r = await runPersona({
      name: 'walker', scenarioId: 'food_courier', seed: 1, weeks: 12,
      mutateSeed: (s) => ({ ...s, lineageId: 'life_walker' }),
      policy: async (ctx) => {
        for (let i = 0; i < 3; i++) await ctx.actions.performHealthActivity('walk');
      },
    });
    const idle = await runPersona({
      name: 'idle', scenarioId: 'food_courier', seed: 1, weeks: 12,
      mutateSeed: (s) => ({ ...s, lineageId: 'life_walker' }),
      policy: () => undefined,
    });
    const walkerEnd = r.rows[r.rows.length - 1].fitness;
    const idleEnd = idle.rows[idle.rows.length - 1].fitness;
    expect(idleEnd).toBe(0);
    expect(walkerEnd).toBeGreaterThan(10);
  });
});

describe('older lives are challenged, not trapped', () => {
  it.each([30, 40, 50, 60])('age %i: the careful player over 52 weeks is ill less than half the time, never with two illnesses at once for long, and alive', async (age) => {
    const r = await runPersona({
      name: 'C', policy: PERSONAS['C careful'](), scenarioId: 'food_courier', seed: 1, weeks: 52,
      mutateSeed: (s) => ({ ...withStartingAge(s, age), lineageId: `life_age_${age}` }),
    });
    expect(r.died).toBe(false);
    const ill = r.rows.filter((x) => x.diseases.length > 0).length;
    const overlapping = r.rows.filter((x) => x.diseases.length > 1).length;
    expect(ill).toBeLessThan(26);
    expect(overlapping).toBeLessThanOrEqual(6);
    expect(r.minHealth).toBeGreaterThan(20);
  });

  it('recovery lowers the next risk: four clear weeks follow every illness', async () => {
    const r = await runPersona({
      name: 'C', policy: PERSONAS['C careful'](), scenarioId: 'food_courier', seed: 1, weeks: 78,
      mutateSeed: (s) => ({ ...withStartingAge(s, 55), lineageId: 'life_recovery_55' }),
    });
    // Find every week an illness list becomes empty, and assert no new illness
    // within the next 3 rows (the 4-week cooldown counted from recovery).
    let violations = 0;
    let onsets = 0;
    for (let i = 1; i < r.rows.length; i++) {
      if (r.rows[i - 1].diseases.length > 0 && r.rows[i].diseases.length === 0) {
        for (let j = i + 1; j <= Math.min(i + 3, r.rows.length - 1); j++) {
          if (r.rows[j].diseases.length > 0) violations++;
        }
      }
      if (r.rows[i].diseases.some((d) => !r.rows[i - 1].diseases.includes(d))) onsets++;
    }
    expect(violations).toBe(0);
    expect(onsets).toBeGreaterThan(0);
  });
});

describe('the long run: a chronic condition is a challenge, not a trap', () => {
  it('age 40, 100 weeks: the careful player who manages what cannot be cured stays alive, keeps health up, and can rebuild fitness', async () => {
    const r = await runPersona({
      name: 'C+doctor', policy: carefulManaged(), scenarioId: 'food_courier', seed: 1, weeks: 100,
      mutateSeed: (s) => ({ ...withStartingAge(s, 40), lineageId: 'life_long_40' }),
    });
    expect(r.died).toBe(false);
    expect(r.minHealth).toBeGreaterThan(20);
    const last = r.rows[r.rows.length - 1];
    expect(last.health).toBeGreaterThan(50);
    // Fitness is not pinned at zero for life: a walk a week nets a point or
    // two once the condition is under management (an unmanaged arthritis
    // drained 5 a week, more than any gym session builds, so it read 0 from
    // week 40 on). Building it back properly takes the gym; this only pins
    // that the floor is no longer welded shut.
    expect(Math.max(...r.rows.slice(50).map((x) => x.fitness))).toBeGreaterThan(0);
  });
});
