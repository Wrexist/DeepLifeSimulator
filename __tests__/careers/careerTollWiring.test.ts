/**
 * Career tradeoffs made real (2026-08-24 gameplay audit, advertised-vs-actual).
 *
 * `lib/careers/jobMarket.ts` has always authored a per-career `weeklyToll`
 * (energy / health / happiness) and a `growth` pace, and the work-tab job card
 * has always RENDERED both — "-8 energy/wk", "Climbs fast" — while the weekly
 * tick charged the same uniform -3 happiness / -2 health to every career, no
 * energy, at one flat progress rate. So the only real difference between jobs
 * was salary and the highest-paying one strictly dominated.
 *
 * These tests pin the wiring both ways:
 *  - profiled careers charge the toll the card advertises (entry level = the
 *    authored numbers exactly, since the seniority factor is 1.0 there),
 *  - negative toll components lighten with seniority exactly like the old
 *    uniform toll; positive components (musician +4 happiness) don't fade,
 *  - careers WITHOUT a profile keep the historical numbers to the digit,
 *  - the authored growth pace drives promotion progress (fast > steady > slow),
 *    with unprofiled careers at exactly the historical rate.
 */
import { applyCareerSalaryAndPenalty } from '@/contexts/game/actions/weekly/applyCareerSalaryAndPenalty';
import { applyCareerProgress } from '@/contexts/game/actions/weekly/applyCareerProgress';
import { getEntryJobProfile, growthProgressMultiplier } from '@/lib/careers/jobMarket';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import type { Career, GameState, GameStats } from '@/contexts/game/types';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const stats = (overrides: Partial<GameStats> = {}): GameStats => ({
  health: 80,
  happiness: 80,
  energy: 80,
  fitness: 60,
  money: 500,
  reputation: 50,
  gems: 0,
  ...overrides,
});

const ctxWith = (s: GameStats): WeekContext => ({
  newStats: s,
  notifications: [],
  preRolls: zeroPreRolls(),
  nextWeeksLived: 100,
});

const career = (id: string, overrides: Partial<Career> = {}): Career => ({
  id,
  levels: [
    { name: 'Entry', salary: 100 },
    { name: 'Mid', salary: 200 },
    { name: 'Top', salary: 400 },
  ],
  level: 0,
  description: 'test career',
  requirements: {} as Career['requirements'],
  progress: 50,
  applied: true,
  accepted: true,
  ...overrides,
});

const stateWorking = (job: Career): GameState =>
  createTestGameState({ currentJob: job.id, careers: [job] });

describe('the weekly toll charges what the job card advertises', () => {
  it('musician at entry: -8 energy, +4 happiness, uniform -2 health fallback', () => {
    const profile = getEntryJobProfile('musician');
    expect(profile?.weeklyToll).toEqual({ energy: -8, happiness: 4 });

    const s = stats();
    const result = applyCareerSalaryAndPenalty(stateWorking(career('musician')), ctxWith(s));
    expect(result.careerEnergyPenalty).toBe(-8);
    expect(result.careerHappinessPenalty).toBe(4);
    expect(result.careerHealthPenalty).toBe(-2); // unstated in the profile → uniform fallback
    expect(s.energy).toBe(72);
    expect(s.happiness).toBe(84);
    expect(s.health).toBe(78);
  });

  it('farmer at entry: -18 energy, +1 health, uniform -3 happiness fallback', () => {
    const s = stats();
    const result = applyCareerSalaryAndPenalty(stateWorking(career('farmer')), ctxWith(s));
    expect(result.careerEnergyPenalty).toBe(-18);
    expect(result.careerHealthPenalty).toBe(1);
    expect(result.careerHappinessPenalty).toBe(-3);
    expect(s.energy).toBe(62);
  });

  it('profiled careers now genuinely differ from one another', () => {
    const run = (id: string) =>
      applyCareerSalaryAndPenalty(stateWorking(career(id)), ctxWith(stats()));
    const musician = run('musician');
    const farmer = run('farmer');
    const fastFood = run('fast_food');
    expect(musician.careerEnergyPenalty).not.toBe(farmer.careerEnergyPenalty);
    expect(musician.careerHappinessPenalty).not.toBe(fastFood.careerHappinessPenalty);
  });

  it('negative components lighten with seniority; positive ones do not fade', () => {
    const top = career('musician', { level: 2 }); // top of a 3-rung ladder → factor 0.3
    const s = stats();
    const result = applyCareerSalaryAndPenalty(stateWorking(top), ctxWith(s));
    expect(result.careerEnergyPenalty).toBe(-2); // round(8 * 0.3) = 2
    expect(result.careerHappinessPenalty).toBe(4); // authored positive, unscaled
    expect(result.careerHealthPenalty).toBe(-1); // round(2 * 0.3) floored at -1
  });

  it('UNPROFILED careers keep the historical numbers to the digit', () => {
    const s = stats();
    const result = applyCareerSalaryAndPenalty(stateWorking(career('engineer')), ctxWith(s));
    expect(result.careerHappinessPenalty).toBe(-3);
    expect(result.careerHealthPenalty).toBe(-2);
    expect(result.careerEnergyPenalty).toBe(0);
    expect(s.energy).toBe(80); // untouched
  });

  it('unemployed: no toll at all', () => {
    const s = stats();
    const result = applyCareerSalaryAndPenalty(
      createTestGameState({ currentJob: undefined }),
      ctxWith(s)
    );
    expect(result.careerEnergyPenalty).toBe(0);
    expect(s).toEqual(stats());
  });
});

describe('the authored growth pace drives promotion progress', () => {
  const progressFor = (id: string): number => {
    const c = career(id, { progress: 0, startedWeeksLived: 0 });
    const { updatedCareers } = applyCareerProgress({
      prevCareers: [c],
      currentJob: id,
      nextWeeksLived: 100, // 100 weeks in → earlyBoost 1.0
      newStats: stats({ energy: 50, happiness: 50, health: 50 }), // perf ≈ 50 → 1.0
      legacyBuffs: undefined,
      goldMindset: false,
      perkMindset: false,
    });
    return updatedCareers[0].progress;
  };

  it('multiplier: fast 1.3 / steady 1.0 / slow 0.7 / unprofiled 1.0', () => {
    expect(growthProgressMultiplier('fast_food')).toBe(1.3);
    expect(growthProgressMultiplier('chef')).toBe(1.0);
    expect(growthProgressMultiplier('farmer')).toBe(0.7);
    expect(growthProgressMultiplier('engineer')).toBe(1.0);
    expect(growthProgressMultiplier(undefined)).toBe(1.0);
  });

  it('a "Climbs fast" ladder outpaces a "Climbs slow" one under identical conditions', () => {
    // fast_food is the tier's FAST ladder (and its lowest ceiling); the
    // musician is now its SLOWEST (and its highest) - the two ends of the same
    // bet. Reassigned 2026-08-25 when the musician stopped being best on every
    // axis at once; before that it held 'fast' AND the top ceiling.
    const fastLadder = progressFor('fast_food'); // 5 * 1.3 = 6.5 → 7
    const slowLadder = progressFor('musician');  // 5 * 0.7 = 3.5 → 4
    const engineer = progressFor('engineer'); // historical flat 5
    expect(fastLadder).toBeGreaterThan(engineer);
    expect(engineer).toBeGreaterThan(slowLadder);
    expect(engineer).toBe(5); // unprofiled = exactly the historical rate
  });
});
