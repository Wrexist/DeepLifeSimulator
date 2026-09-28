import { advancePlayStreak, playStreakBonusPercent } from '../playStreak';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 28, 10, 0, 0);

describe('advancePlayStreak', () => {
  it('ten weeks in one sitting is still a 1-day streak', () => {
    let s = advancePlayStreak(undefined, T0);
    for (let i = 1; i < 10; i++) s = advancePlayStreak(s, T0 + i * 60_000);
    expect(s.count).toBe(1);
    expect(playStreakBonusPercent(s.count)).toBe(2);
  });

  it('advances once per new day inside the window', () => {
    let s = advancePlayStreak(undefined, T0);
    s = advancePlayStreak(s, T0 + DAY);
    s = advancePlayStreak(s, T0 + DAY + 1000);
    s = advancePlayStreak(s, T0 + 2 * DAY);
    expect(s.count).toBe(3);
    expect(s.longestStreak).toBe(3);
  });

  it('resets after 48h away, and on a clock moved backwards', () => {
    const s = advancePlayStreak({ count: 5, lastPlayTimestamp: T0, longestStreak: 5 }, T0 + 3 * DAY);
    expect(s.count).toBe(1);
    expect(s.longestStreak).toBe(5);
    expect(advancePlayStreak({ count: 5, lastPlayTimestamp: T0, longestStreak: 5 }, T0 - DAY).count).toBe(1);
  });

  it('caps the bonus at 20%', () => {
    expect(playStreakBonusPercent(50)).toBe(20);
    expect(playStreakBonusPercent(0)).toBe(0);
    expect(playStreakBonusPercent(NaN)).toBe(0);
  });
});
