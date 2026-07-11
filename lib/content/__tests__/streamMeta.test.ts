import {
  rollingAverageViewers,
  nextHypeStreak,
  hypeChanceForStreak,
  HYPE_BASE_CHANCE,
  HYPE_MAX_CHANCE,
  AVG_VIEWERS_WINDOW,
} from '../streamMeta';

describe('rollingAverageViewers', () => {
  it('returns 0 for empty history', () => {
    expect(rollingAverageViewers([])).toBe(0);
  });

  it('is the mean of the recorded viewers', () => {
    expect(rollingAverageViewers([{ viewers: 100 }, { viewers: 200 }, { viewers: 300 }])).toBe(200);
  });

  it('only averages the most-recent window (newest-first)', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ viewers: i === 0 ? 1000 : 0 }));
    // Window includes the leading 1000 and (window-1) zeros.
    expect(rollingAverageViewers(history)).toBe(Math.round(1000 / AVG_VIEWERS_WINDOW));
  });

  it('ignores non-finite viewer values', () => {
    expect(rollingAverageViewers([{ viewers: 100 }, { viewers: NaN as unknown as number }])).toBe(50);
  });
});

describe('nextHypeStreak', () => {
  it('starts at 1 for a first-ever stream (no lastStreamWeek)', () => {
    expect(nextHypeStreak(undefined, undefined, 5)).toBe(1);
  });

  it('increments on a consecutive week', () => {
    expect(nextHypeStreak(3, 4, 5)).toBe(4);
  });

  it('is unchanged when streaming again the same week', () => {
    expect(nextHypeStreak(3, 5, 5)).toBe(3);
  });

  it('resets to 1 after a multi-week gap', () => {
    expect(nextHypeStreak(6, 2, 5)).toBe(1);
  });
});

describe('hypeChanceForStreak', () => {
  it('is the base chance at streak 1', () => {
    expect(hypeChanceForStreak(1)).toBeCloseTo(HYPE_BASE_CHANCE, 6);
  });

  it('rises with the streak', () => {
    expect(hypeChanceForStreak(3)).toBeGreaterThan(hypeChanceForStreak(1));
  });

  it('never exceeds the 25% ceiling however long the streak', () => {
    expect(hypeChanceForStreak(1000)).toBeLessThanOrEqual(HYPE_MAX_CHANCE);
    expect(HYPE_MAX_CHANCE).toBeLessThanOrEqual(0.25);
  });
});
