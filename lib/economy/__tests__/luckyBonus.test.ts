/**
 * The luck de-scheduling fix (2026-08-24 gameplay audit).
 *
 * The old lucky-bonus seed, `(weeksLived * 777 + 42) % 100`, was a fixed
 * permutation of 0..99 with period exactly 100 — the same public "lucky weeks"
 * schedule for every player, every life, every save, with zero clustering.
 * These tests pin the properties the replacement must have: deterministic per
 * (week, life), different between lives, uniform-ish, and NOT a repeating
 * 100-week pattern.
 */
import { rollWeeklyLuckSeed } from '../luckyBonus';
import { rollCliffhanger } from '@/lib/events/cliffhangerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('rollWeeklyLuckSeed', () => {
  it('is deterministic for the same week and life', () => {
    expect(rollWeeklyLuckSeed(120, 'lineage-a', 1)).toBe(rollWeeklyLuckSeed(120, 'lineage-a', 1));
  });

  it('differs between lives at the same week', () => {
    const a: number[] = [];
    const b: number[] = [];
    for (let w = 0; w < 50; w++) {
      a.push(rollWeeklyLuckSeed(w, 'lineage-a', 1));
      b.push(rollWeeklyLuckSeed(w, 'lineage-a', 2));
    }
    expect(a).not.toEqual(b);
  });

  it('is NOT a repeating 100-week schedule', () => {
    const first: number[] = [];
    const second: number[] = [];
    for (let w = 0; w < 100; w++) {
      first.push(rollWeeklyLuckSeed(w, 'lineage-a', 1));
      second.push(rollWeeklyLuckSeed(w + 100, 'lineage-a', 1));
    }
    expect(first).not.toEqual(second);
    // And within one window it is not a permutation of 0..99 (the old seed
    // visited every residue exactly once — i.e. exactly one "rare" week per
    // 100, always). A real uniform draw collides.
    expect(new Set(first).size).toBeLessThan(100);
  });

  it('stays in 0..99 and lands each tier band at a plausible rate', () => {
    let rare = 0;
    let medium = 0;
    let small = 0;
    const n = 5000;
    for (let w = 0; w < n; w++) {
      const seed = rollWeeklyLuckSeed(w, 'lineage-a', 1);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(99);
      if (seed < 1) rare++;
      else if (seed < 6) medium++;
      else if (seed < 20) small++;
    }
    // Bands are 1% / 5% / 14% — allow generous tolerance, this is a sanity
    // check on uniformity, not a chi-squared test.
    expect(rare / n).toBeGreaterThan(0.002);
    expect(rare / n).toBeLessThan(0.03);
    expect(medium / n).toBeGreaterThan(0.02);
    expect(medium / n).toBeLessThan(0.09);
    expect(small / n).toBeGreaterThan(0.09);
    expect(small / n).toBeLessThan(0.2);
  });
});

describe('rollCliffhanger timing (same fix class)', () => {
  const stateAt = (weeksLived: number, lineageId: string) =>
    createTestGameState({
      weeksLived,
      lifeStartWeek: 0,
      lineageId,
      currentJob: 'engineer',
      careers: [
        {
          id: 'engineer',
          levels: [{ name: 'Junior', salary: 100 }],
          level: 0,
          description: '',
          requirements: {},
          progress: 0,
          applied: true,
          accepted: true,
        },
      ] as never,
    });

  const fireWeeks = (lineageId: string): number[] => {
    const weeks: number[] = [];
    for (let w = 20; w < 420; w++) {
      if (rollCliffhanger(stateAt(w, lineageId), w)) weeks.push(w);
    }
    return weeks;
  };

  it('is deterministic per week and life', () => {
    expect(fireWeeks('lineage-a')).toEqual(fireWeeks('lineage-a'));
  });

  it('fires at roughly the documented ~7% cadence', () => {
    const rate = fireWeeks('lineage-a').length / 400;
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.14);
  });

  it('is not the same schedule for two different lives', () => {
    expect(fireWeeks('lineage-a')).not.toEqual(fireWeeks('lineage-b'));
  });

  it('is NOT a fixed 100-week repeating pattern within one life', () => {
    const weeks = fireWeeks('lineage-a');
    const inFirst = weeks.filter((w) => w >= 20 && w < 120).map((w) => w % 100);
    const inSecond = weeks.filter((w) => w >= 120 && w < 220).map((w) => w % 100);
    // The old linear-congruential roll made these two sets identical forever.
    expect(inFirst).not.toEqual(inSecond);
  });
});
