/**
 * A week counts toward a zero-stat death only if it ENDED at zero.
 *
 * The counters were decided mid-tick, and pets, housing, relationship support
 * and savings goals still added health/happiness afterwards. So a week that
 * ended at 1-2 counted toward "health reached 0 for 4 weeks", while the HUD -
 * which warns only at <= 0 - showed nothing, and the character died without a
 * warning. 2026-10-17 audit. Checked on the real tick over a neglected life.
 */
import { runPersona } from '../helpers/earlyGameSim';

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

describe('zero-stat death counters', () => {
  it('do not count a week a pet lifted back above zero', async () => {
    // Health 2 decays to 0 mid-tick; a healthy pet's companionship then adds
    // +1 (applyPets runs after the counters were decided). The week ends at 1.
    const rows: { health: number; counter: number }[] = [];
    await runPersona({
      name: 'pet lifts health',
      scenarioId: 'food_courier',
      seed: 1,
      weeks: 2,
      mutateSeed: (st) => ({
        ...st,
        weeksLived: st.weeksLived + 12,
        lifeStartWeek: st.weeksLived,
        stats: { ...st.stats, health: 2, happiness: 80 },
        lastDiseaseWeek: st.weeksLived + 12,
        pets: [{ id: 'rex', name: 'Rex', type: 'dog', age: 2, hunger: 100, happiness: 95, health: 95 }],
      }),
      policy: (ctx) => {
        const s = ctx.state();
        rows.push({ health: s.stats.health, counter: s.healthZeroWeeks ?? 0 });
      },
    });
    // rows[1] is the state after the first tick: lifted to 1 by the pet, so
    // the week must not count (it counted 1 before the fix).
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[1].health).toBeGreaterThan(0);
    expect(rows[1].counter).toBe(0);
  });

  it('count a week a disease pushed to zero after decay (2026-10-21, TICK-4)', async () => {
    // Health 6 survives decay mid-tick (the old decision point reset the
    // counter there); the disease's -10 then lands later in the tick and the
    // week ENDS at 0. That week must count - it did not before the fix.
    const rows: { health: number; counter: number }[] = [];
    await runPersona({
      name: 'disease ends at zero',
      scenarioId: 'food_courier',
      seed: 1,
      weeks: 2,
      mutateSeed: (st) => ({
        ...st,
        weeksLived: st.weeksLived + 12,
        lifeStartWeek: st.weeksLived,
        stats: { ...st.stats, health: 6, happiness: 80 },
        lastDiseaseWeek: st.weeksLived + 12,
        diseases: [{
          id: 'flu', name: 'Flu', severity: 'serious', curable: true, treatmentRequired: false,
          effects: { health: -10 }, naturalRecoveryWeeks: 50,
        }] as typeof st.diseases,
      }),
      policy: (ctx) => {
        const s = ctx.state();
        rows.push({ health: s.stats.health, counter: s.healthZeroWeeks ?? 0 });
      },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[1].health).toBeLessThanOrEqual(0);
    expect(rows[1].counter).toBe(1);
  });

  it('never count a week whose final health or happiness was above zero', async () => {
    const violations: string[] = [];
    let sawCounter = false;
    await runPersona({
      name: 'neglect',
      scenarioId: 'food_courier',
      seed: 3,
      weeks: 60,
      policy: (ctx) => {
        // `state()` at the start of a week is the previous tick's final state.
        const s = ctx.state();
        if ((s.healthZeroWeeks ?? 0) > 0 || (s.happinessZeroWeeks ?? 0) > 0) sawCounter = true;
        if ((s.healthZeroWeeks ?? 0) > 0 && s.stats.health > 0) {
          violations.push(`week ${ctx.week}: healthZeroWeeks ${s.healthZeroWeeks} at health ${s.stats.health}`);
        }
        if ((s.happinessZeroWeeks ?? 0) > 0 && s.stats.happiness > 0) {
          violations.push(`week ${ctx.week}: happinessZeroWeeks ${s.happinessZeroWeeks} at happiness ${s.stats.happiness}`);
        }
        // ...and the converse (TICK-4): a week that ended AT zero must count.
        if (ctx.week > 0 && s.stats.health <= 0 && (s.healthZeroWeeks ?? 0) === 0) {
          violations.push(`week ${ctx.week}: health ${s.stats.health} but healthZeroWeeks 0`);
        }
        if (ctx.week > 0 && s.stats.happiness <= 0 && (s.happinessZeroWeeks ?? 0) === 0) {
          violations.push(`week ${ctx.week}: happiness ${s.stats.happiness} but happinessZeroWeeks 0`);
        }
      },
    });
    expect(violations).toEqual([]);
    // The run must actually reach the zero-stat state, or it measured nothing.
    expect(sawCounter).toBe(true);
  });
});
