/**
 * Life-moment cadence — Master Program 9.
 *
 * The generator's own comment promises "2-3 a year"; at 1.5%/week with a
 * 52-week pity every simulated persona met exactly one moment in 100 weeks.
 * These pin the authored cadence on the real generator over five years of
 * weeks, and that a drought never outlasts the pity.
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import { generateLifeMoment, LIFE_MOMENT_PITY_WEEKS, LIFE_MOMENT_WEEKLY_CHANCE } from '../lifeMomentGenerator';

const life = (lineageId: string) =>
  createTestGameState({ weeksLived: 104, lifeStartWeek: 104, lineageId, generationNumber: 1, currentJob: 'janitor' });

/** Weeks on which a moment fires, answering (clearing) each one the next week. */
function onsets(lineageId: string, weeks: number): number[] {
  const s = life(lineageId);
  const out: number[] = [];
  let last = 0;
  for (let w = 1; w <= weeks; w++) {
    s.weeksLived = 104 + w;
    s.lifeMoments = { lastMomentWeek: last, momentsThisWeek: 0, totalMoments: out.length, pendingMoment: undefined };
    if (generateLifeMoment(s)) { out.push(w); last = 104 + w; }
  }
  return out;
}

describe('life moments arrive at the authored pace', () => {
  it('is 5% a week with a 30-week pity', () => {
    expect(LIFE_MOMENT_WEEKLY_CHANCE).toBeCloseTo(0.05, 6);
    expect(LIFE_MOMENT_PITY_WEEKS).toBe(30);
  });

  it('a five-year life meets roughly two to four moments a year, never a 30-week silence', () => {
    for (const id of ['life_m1', 'life_m2', 'life_m3']) {
      const weeks = onsets(id, 260);
      expect(weeks.length).toBeGreaterThanOrEqual(8);
      expect(weeks.length).toBeLessThanOrEqual(26);
      let prev = 0;
      for (const w of weeks) { expect(w - prev).toBeLessThanOrEqual(LIFE_MOMENT_PITY_WEEKS); prev = w; }
    }
  });

  it('two lives meet moments on different weeks', () => {
    expect(onsets('life_m1', 260)).not.toEqual(onsets('life_m2', 260));
  });
});
