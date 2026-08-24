/**
 * The "This Life" timeline builder (2026-08-24, brief §11).
 *
 * The stamps always existed — careers (v42), births (`birthWeeksLived`),
 * marriages (`marriageWeek`), notable events, journal — and were never
 * assembled into a chronological view. These tests pin the assembly: every
 * source contributes, order is newest-first and deterministic, and one bad
 * source loses its rows rather than the timeline.
 */
import { buildLifeTimeline, MAX_TIMELINE_ENTRIES } from '../lifeTimeline';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function livedState(): GameState {
  const s = createTestGameState({
    weeksLived: 800,
    lifeStartWeek: 0,
    family: {
      ...createTestGameState().family,
      children: [
        { id: 'c1', name: 'Ash', age: 6, birthWeeksLived: 490 } as never,
      ],
    },
    relationships: [
      { id: 'p1', name: 'Sam', type: 'spouse', relationshipScore: 90, personality: '', age: 33, marriageWeek: 380 } as never,
    ],
    eventLog: [
      { id: 'e1', description: 'Won a huge contract.', choice: 'x', week: 1, year: 2030, weeksLived: 600, category: 'general', effects: { money: 40_000 } } as never,
      { id: 'e2', description: 'A quiet week.', choice: 'x', week: 1, year: 2030, weeksLived: 610, category: 'general', effects: { money: 5 } } as never,
    ],
    journal: [
      { id: 'j1', atWeek: 700, title: 'A week to remember', details: 'Everything clicked.', tags: [] },
    ],
  });
  s.lifetimeStatistics = {
    ...s.lifetimeStatistics,
    careerHistory: [
      { job: 'chef', weeks: 200, earnings: 30_000, startWeek: 120, endWeek: 320, title: 'Line Cook' },
      { job: 'ceo', weeks: 100, earnings: 90_000, startWeek: 350 },
    ],
    peakNetWorth: 2_400_000,
    peakNetWorthWeek: 750,
  } as GameState['lifetimeStatistics'];
  return s;
}

describe('buildLifeTimeline', () => {
  it('assembles every source into one chronology', () => {
    const timeline = buildLifeTimeline(livedState());
    const titles = timeline.map((e) => e.title);
    expect(titles).toContain('Started as Line Cook');
    expect(titles).toContain('Left Line Cook');
    expect(titles).toContain('Started as ceo');
    expect(titles).toContain('Ash was born');
    expect(titles).toContain('Married Sam');
    expect(titles).toContain('Won a huge contract.');
    expect(titles).toContain('A week to remember');
    expect(titles.some((t) => t.startsWith('Fortune peaked'))).toBe(true);
    // The trivial event stayed out.
    expect(titles).not.toContain('A quiet week.');
  });

  it('is newest-first, stamped with the age at each moment', () => {
    const timeline = buildLifeTimeline(livedState());
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i - 1].week).toBeGreaterThanOrEqual(timeline[i].week);
    }
    const marriage = timeline.find((e) => e.title === 'Married Sam');
    expect(marriage?.age).toBe(Math.floor(18 + 380 / 52));
  });

  it('is deterministic across calls', () => {
    const s = livedState();
    expect(buildLifeTimeline(s)).toEqual(buildLifeTimeline(s));
  });

  it('degrades to empty on nothing, never throws on a partial state', () => {
    expect(buildLifeTimeline(null)).toEqual([]);
    expect(buildLifeTimeline(undefined)).toEqual([]);
    expect(() => buildLifeTimeline({} as GameState)).not.toThrow();
  });

  it('caps a very long life instead of dumping the archive', () => {
    const s = livedState();
    s.journal = Array.from({ length: 200 }, (_, i) => ({
      id: `j${i}`, atWeek: i + 1, title: `Week ${i}`, details: '', tags: [],
    }));
    expect(buildLifeTimeline(s).length).toBeLessThanOrEqual(MAX_TIMELINE_ENTRIES);
  });
});

describe('collapsing repeated beats', () => {
  /**
   * A standing nudge is re-journalled every week it holds, so an unhoused
   * stretch used to render as ten identical rows and nothing else - found by
   * looking at the shipped timeline in the running app.
   */
  const withJournal = (titles: string[]) =>
    createTestGameState({
      weeksLived: 400,
      lifeStartWeek: 0,
      journal: titles.map((title, i) => ({
        id: `j${i}`, atWeek: 100 + i, title, details: '', tags: [],
      })),
    });

  it('collapses a consecutive run into one row carrying the count', () => {
    const timeline = buildLifeTimeline(withJournal(['Nowhere to live', 'Nowhere to live', 'Nowhere to live']));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].repeats).toBe(3);
    // Stamped at the most recent occurrence, since the timeline reads newest-first.
    expect(timeline[0].week).toBe(102);
  });

  it('keeps a beat that recurs AFTER something else happened', () => {
    const timeline = buildLifeTimeline(withJournal(['Nowhere to live', 'Got a job', 'Nowhere to live']));
    expect(timeline.map((e) => e.title)).toEqual(['Nowhere to live', 'Got a job', 'Nowhere to live']);
    expect(timeline.every((e) => e.repeats === undefined)).toBe(true);
  });

  it('collapses before the cap, so repeats cannot crowd out real events', () => {
    const titles = Array.from({ length: 80 }, () => 'Nowhere to live');
    titles[0] = 'A real milestone'; // oldest entry
    const timeline = buildLifeTimeline(withJournal(titles));
    expect(timeline.map((e) => e.title)).toContain('A real milestone');
    expect(timeline.length).toBeLessThanOrEqual(MAX_TIMELINE_ENTRIES);
  });
});
