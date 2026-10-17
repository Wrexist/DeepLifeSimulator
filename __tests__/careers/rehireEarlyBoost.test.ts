/**
 * Quitting does not re-arm the early-career boost — owner call, 2026-10-17.
 *
 * `applyCareerProgress` gives 2.5x promotion progress for the first 20 weeks of
 * a career and 1.5x for the next 20. It counted from `startedWeeksLived`, which
 * every hire path re-stamps, so quitting and re-applying handed the newcomer's
 * 2.5x back to a player who already held the job for years - at the level they
 * left at. The boost now counts from the FIRST `careerHistory` entry for the
 * job in this life. The re-hire keeps its level (progress and tenure already
 * reset on the way out); it just does not get the newcomer's boost again.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  applyCareerProgress,
  earlyCareerBoost,
  firstCareerStartWeek,
  type CareerProgressInput,
} from '@/contexts/game/actions/weekly/applyCareerProgress';
import type { Career, CareerHistoryEntry } from '@/contexts/game/types';

const JOB = 'fast_food';
const NOW = 301;

function employed(startedWeeksLived: number): Career {
  const base = createTestGameState().careers.find((c) => c.id === JOB)!;
  return { ...base, level: 2, progress: 0, applied: true, accepted: true, startedWeeksLived };
}

function progressAfterOneWeek(career: Career, careerHistory?: CareerProgressInput['careerHistory']): number {
  // Stats chosen for a 50-79 performance (the neutral 1.0x band).
  const stats = createTestGameState({ stats: { energy: 60, happiness: 60, health: 60 } }).stats;
  const { updatedCareers } = applyCareerProgress({
    prevCareers: [career],
    currentJob: JOB,
    nextWeeksLived: NOW,
    newStats: stats,
    legacyBuffs: undefined,
    goldMindset: false,
    perkMindset: false,
    careerHistory,
  });
  return updatedCareers[0].progress;
}

const entry = (job: string, startWeek: number, endWeek?: number): CareerHistoryEntry => ({
  job, startWeek, endWeek, weeks: endWeek === undefined ? 0 : endWeek - startWeek, earnings: 0,
});

describe('the early-career boost after a quit and re-hire', () => {
  // Rehired at week 300 after a first stint from week 120 to 290.
  const rehired = employed(300);
  const history = [entry(JOB, 120, 290), entry(JOB, 300)];

  it('counts from the first time the job was started in this life', () => {
    expect(firstCareerStartWeek(rehired, history, NOW)).toBe(120);
    // A 181-week veteran gets the normal rate, not the newcomer's 2.5x.
    expect(progressAfterOneWeek(rehired, history)).toBe(progressAfterOneWeek(employed(120), history));
    expect(progressAfterOneWeek(rehired, history)).toBeLessThan(progressAfterOneWeek(rehired, undefined));
  });

  it('still gives a genuinely new career its full boost', () => {
    const fresh = employed(300);
    const ownStint = [entry(JOB, 300)];
    expect(firstCareerStartWeek(fresh, ownStint, NOW)).toBe(300);
    expect(progressAfterOneWeek(fresh, ownStint)).toBe(progressAfterOneWeek(fresh, undefined));
    expect(earlyCareerBoost(NOW - 300)).toBe(2.5);
  });

  it('a stint in a DIFFERENT job does not count against this one', () => {
    const fresh = employed(300);
    const otherJob = [entry('retail', 120, 290), entry(JOB, 300)];
    expect(firstCareerStartWeek(fresh, otherJob, NOW)).toBe(300);
    expect(progressAfterOneWeek(fresh, otherJob)).toBe(progressAfterOneWeek(fresh, undefined));
  });

  it('a short first stint leaves only the rest of the 40-week window', () => {
    // First stint weeks 270-280, rehired at 300: 31 weeks in → 1.5x, not 2.5x.
    const backSoon = employed(300);
    const shortHistory = [entry(JOB, 270, 280), entry(JOB, 300)];
    expect(firstCareerStartWeek(backSoon, shortHistory, NOW)).toBe(270);
    expect(earlyCareerBoost(NOW - 270)).toBe(1.5);
  });

  it('ignores history entries dated after the current week', () => {
    expect(firstCareerStartWeek(employed(300), [entry(JOB, 900)], NOW)).toBe(300);
  });

  it('keeps the legacy reading for a career with no start week', () => {
    const noStart = { ...employed(0), startedWeeksLived: undefined };
    expect(firstCareerStartWeek(noStart, undefined, NOW)).toBe(0);
  });
});
