/**
 * The weekly disease tick, `applyDiseasesForWeek`.
 *
 * ## What this file used to be
 *
 * Seven tests under a docstring reading "Integration tests for disease system
 * with week progression — These tests verify that diseases work correctly with
 * the nextWeek function". It imported `createTestGameState` and NOTHING ELSE:
 * no disease module, no week reducer. Every test built a state literal and
 * asserted the literal back —
 *
 *     diseases: [{ effects: { health: -2, energy: -3 } }]   // written here
 *     expect(disease.effects.health).toBeLessThan(0);       // read back here
 *
 * — and one of them said so outright, in a comment: "Week progression would
 * call generateRandomDisease. This is tested indirectly through the generator
 * tests." No change to the disease system, however total, could have failed any
 * of them. Meanwhile `applyDiseasesForWeek`, which is where week progression
 * actually happens, had no test file of its own at all.
 *
 * These call it.
 */
import {
  applyDiseasesForWeek,
  type DiseaseHistory,
  type DiseaseTickInput,
} from '@/contexts/game/actions/weekly/applyDiseases';
import type { Disease, GameStats } from '@/contexts/game/types';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';

function stats(over: Partial<GameStats> = {}): GameStats {
  return {
    health: 50, fitness: 50, happiness: 50, energy: 50,
    money: 1000, reputation: 0, gems: 0,
    ...over,
  } as GameStats;
}

function ctx(over: Partial<WeekContext> = {}): WeekContext {
  return {
    newStats: stats(),
    notifications: [] as WeekNotification[],
    // Pre-rolled and HIGH, so the 10%-per-week complication roll never fires:
    // the reducer indexes these per disease, and an empty stub throws on
    // `.length`. Deterministic on purpose — a worsening roll landing at random
    // would make the recovery assertions below flap.
    preRolls: {
      diseaseComplication: [0.99],
      diseaseProgression: [0.99],
    } as unknown as WeekContext['preRolls'],
    nextWeeksLived: 10,
    ...over,
  } as WeekContext;
}

function input(over: Partial<DiseaseTickInput> = {}): DiseaseTickInput {
  return {
    prevDiseases: [],
    prevDiseaseHistory: undefined,
    prevShowSicknessModal: false,
    prevLastDiseaseWeek: undefined,
    newDisease: null,
    ...over,
  };
}

function disease(over: Partial<Disease> = {}): Disease {
  return {
    id: 'common_cold',
    name: 'Common Cold',
    severity: 'mild',
    effects: { health: -2, energy: -3, happiness: -1 },
    curable: true,
    contractedWeek: 9,
    description: '',
    ...over,
  } as Disease;
}

describe('applyDiseasesForWeek', () => {
  it('spends the disease effects out of the running stat accumulator', () => {
    // The reducer mutates `ctx.newStats` in place, so the assertion is on the
    // accumulator and not on the return value. Asserting the fixture's own
    // `effects` object — which is what this file used to do — could never have
    // told the two apart.
    const c = ctx({ newStats: stats({ health: 50, energy: 50, happiness: 50 }) });
    applyDiseasesForWeek(input({ prevDiseases: [disease()] }), c);

    expect(c.newStats.health).toBeLessThan(50);
    expect(c.newStats.energy).toBeLessThan(50);
    expect(c.newStats.happiness).toBeLessThan(50);
  });

  it('leaves the stats alone when there is no disease', () => {
    const c = ctx({ newStats: stats({ health: 50, energy: 50 }) });
    const r = applyDiseasesForWeek(input(), c);

    expect(c.newStats.health).toBe(50);
    expect(c.newStats.energy).toBe(50);
    expect(r.diseases).toEqual([]);
    expect(r.deathTriggered).toBe(false);
  });

  it('counts the death countdown down without killing on the way', () => {
    const r = applyDiseasesForWeek(
      input({ prevDiseases: [disease({ severity: 'critical', weeksUntilDeath: 3 })] }),
      ctx(),
    );

    expect(r.deathTriggered).toBe(false);
    expect(r.deathReason).toBeUndefined();
    expect(r.diseases[0].weeksUntilDeath).toBe(2);
  });

  it('kills when the countdown reaches zero, and records it in the history', () => {
    const r = applyDiseasesForWeek(
      input({ prevDiseases: [disease({ severity: 'critical', weeksUntilDeath: 1 })] }),
      ctx(),
    );

    expect(r.deathTriggered).toBe(true);
    expect(r.deathReason).toBe('health');
    expect(r.diseaseHistory.deathsFromDisease).toBe(1);
  });

  it('recovers a disease naturally and marks the week it was cured', () => {
    const history: DiseaseHistory = {
      diseases: [{ id: 'common_cold', name: 'Common Cold', contractedWeek: 9, severity: 'mild' }],
      totalDiseases: 1,
      totalCured: 0,
      deathsFromDisease: 0,
    };
    const r = applyDiseasesForWeek(
      input({
        prevDiseases: [disease({ naturalRecoveryWeeks: 1 })],
        prevDiseaseHistory: history,
      }),
      ctx({ nextWeeksLived: 11 }),
    );

    expect(r.diseases).toHaveLength(0);
    expect(r.diseaseHistory.totalCured).toBe(1);
    expect(r.diseaseHistory.diseases[0].curedWeek).toBe(11);
  });

  it('recovers faster for a fit, healthy character than for a sick one', () => {
    // The recovery decrement takes bonuses from health > 70 and fitness > 50,
    // which is a behaviour of the reducer and not of the fixture.
    const sick = applyDiseasesForWeek(
      input({ prevDiseases: [disease({ naturalRecoveryWeeks: 3 })] }),
      ctx({ newStats: stats({ health: 40, fitness: 20 }) }),
    );
    const fit = applyDiseasesForWeek(
      input({ prevDiseases: [disease({ naturalRecoveryWeeks: 3 })] }),
      ctx({ newStats: stats({ health: 90, fitness: 80 }) }),
    );

    expect(sick.diseases[0].naturalRecoveryWeeks)
      .toBeGreaterThan(fit.diseases[0].naturalRecoveryWeeks!);
  });

  it('admits a newly generated disease and records the week', () => {
    const r = applyDiseasesForWeek(
      input({ newDisease: disease({ id: 'flu', name: 'Flu' }) }),
      ctx({ nextWeeksLived: 12 }),
    );

    expect(r.diseases.map((d) => d.id)).toContain('flu');
    expect(r.diseaseHistory.totalDiseases).toBe(1);
    expect(r.lastDiseaseWeek).toBe(12);
  });

  it('never raises the sickness modal, and clears one that got stuck on', () => {
    // Deliberate: the popup interrupted the Next Week flow, so the tick forces
    // the flag false every week, which also self-heals a save where it stuck.
    // Asserted because "forced false" and "never set" look identical from the
    // outside until a save arrives with it already true.
    const admitted = applyDiseasesForWeek(input({ newDisease: disease() }), ctx());
    expect(admitted.showSicknessModal).toBe(false);

    const stuck = applyDiseasesForWeek(input({ prevShowSicknessModal: true }), ctx());
    expect(stuck.showSicknessModal).toBe(false);
  });

  it('survives a history object whose `diseases` array is missing', () => {
    // The crash guard the reducer documents: a save can carry a diseaseHistory
    // that has no `.diseases`, and the `||` fallback only catches null.
    const r = applyDiseasesForWeek(
      input({
        prevDiseases: [disease()],
        prevDiseaseHistory: { totalDiseases: 1, totalCured: 0, deathsFromDisease: 0 } as DiseaseHistory,
      }),
      ctx(),
    );

    expect(Array.isArray(r.diseaseHistory.diseases)).toBe(true);
  });
});
