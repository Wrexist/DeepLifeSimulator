/**
 * Education speed is no longer quantized to integers (2026-08-23).
 *
 * `Math.max(1, Math.ceil(mult))` made 1.10x, 1.25x and 1.50x identical
 * (decrement 2 — a "+10%" bonus delivering +100%), and swallowed the
 * 16,000-point Learning Master synergy whole. The fractional part is now a
 * deterministic weekly roll, so expected speed equals the purchased
 * multiplier exactly while weeksRemaining stays an integer.
 */
import { applyEducationProgression } from '../applyEducationProgression';
import type { Education } from '@/contexts/game/types';

const edu = (weeksRemaining: number, week: number): Education => ({
  id: 'mba', name: 'MBA', description: '', cost: 0, duration: 150,
  completed: false, weeksRemaining, paused: false,
  // Anchor exam/campus timers to the current week so neither fires — this
  // suite measures ONLY the decrement.
  lastExamWeek: week, lastCampusEventWeek: week,
});

const run = (mult: number, week: number) =>
  applyEducationProgression(
    {
      prevEducations: [edu(100, week)],
      nextWeeksLived: week,
      experienceMultiplier: mult,
      goldFastLearner: false,
      perkFastLearner: false,
    } as never,
    { notifications: [], newStats: { energy: 100 }, lifeSkillMods: undefined } as never,
  );

describe('fractional speed', () => {
  it('multiplier 1 always decrements exactly 1 (unchanged baseline)', () => {
    for (const week of [10, 11, 12, 13, 14]) {
      const out = run(1, week);
      expect(out.updatedEducations[0].weeksRemaining).toBe(99);
    }
  });

  it('weeksRemaining stays an integer at every multiplier', () => {
    for (const mult of [1.1, 1.25, 1.5, 2.35]) {
      for (const week of [20, 21, 22]) {
        const rem = run(mult, week).updatedEducations[0].weeksRemaining;
        expect(Number.isInteger(rem)).toBe(true);
      }
    }
  });

  it('1.10x averages ~1.1 weeks/tick over many weeks - not the old flat 2', () => {
    let total = 0;
    const N = 400;
    for (let week = 0; week < N; week++) {
      const rem = run(1.1, week).updatedEducations[0].weeksRemaining!;
      total += 100 - rem;
    }
    const avg = total / N;
    expect(avg).toBeGreaterThan(1.02);
    expect(avg).toBeLessThan(1.18);
  });

  it('the paid tiers are distinguishable again: 1.5x beats 1.25x beats 1.1x', () => {
    const avgFor = (mult: number) => {
      let total = 0;
      const N = 400;
      for (let week = 0; week < N; week++) {
        total += 100 - run(mult, week).updatedEducations[0].weeksRemaining!;
      }
      return total / N;
    };
    const a = avgFor(1.1), b = avgFor(1.25), c = avgFor(1.5);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('is deterministic for a given week (StrictMode double-invoke safety)', () => {
    for (const week of [30, 31, 32]) {
      expect(run(1.5, week).updatedEducations[0].weeksRemaining)
        .toBe(run(1.5, week).updatedEducations[0].weeksRemaining);
    }
  });
});
