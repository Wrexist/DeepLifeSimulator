import { LIFE_CHAPTERS, getActiveChapter, getUpcomingChapter } from '@/lib/progress/lifeChapters';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

/**
 * "Once I get to chapter 2 it just disappears" (player report, 2026-10-11).
 * Finishing chapter 2 before chapter 3's opening week left NO active chapter,
 * so every chapter surface vanished. The gap must name what comes next.
 */
describe('between chapters', () => {
  const ch3 = LIFE_CHAPTERS[2];
  const state = createTestGameState({
    completedChapters: [LIFE_CHAPTERS[0].id, LIFE_CHAPTERS[1].id],
    weeksLived: 9,
    lifeStartWeek: 0,
  });

  it('has no active chapter before chapter 3 opens (the gap)', () => {
    expect(ch3.weekRange[0]).toBeGreaterThan(9);
    expect(getActiveChapter(state)).toBeUndefined();
  });

  it('names chapter 3 and counts down to it', () => {
    const up = getUpcomingChapter(state);
    expect(up?.chapter.id).toBe(ch3.id);
    expect(up?.number).toBe(3);
    expect(up?.weeksUntil).toBe(ch3.weekRange[0] - 9);
  });

  it('is undefined once a chapter is active (the control)', () => {
    const open = { ...state, weeksLived: ch3.weekRange[0] };
    expect(getActiveChapter(open)?.id).toBe(ch3.id);
    expect(getUpcomingChapter(open)).toBeUndefined();
  });
});
