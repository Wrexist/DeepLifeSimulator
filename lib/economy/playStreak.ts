/**
 * The play streak: consecutive DAYS the player came back and played, worth
 * +2% income per day up to +20%.
 *
 * It used to count every Next Week tap made within 48 real hours of the last
 * one, so ten taps in one sitting reached the full +20% and kept it for as long
 * as the player never stepped away for two days. That is not a streak - it is a
 * flat +20% for playing fast - and it made weekly cash depend on how quickly
 * the player tapped. The counter now advances at most once per UTC calendar
 * day, which is what "come back tomorrow" loss aversion was meant to reward.
 *
 * A forward device-clock scrub can at best reach the same +20% a daily player
 * has, and still has to play a week each "day" to collect anything: the bonus
 * only pays inside the weekly tick.
 */
export const PLAY_STREAK_WINDOW_HOURS = 48;
export const PLAY_STREAK_BONUS_PER_DAY = 2;
export const PLAY_STREAK_MAX_BONUS = 20;

const MS_PER_DAY = 86_400_000;

export interface PlayStreak {
  count: number;
  lastPlayTimestamp: number;
  longestStreak: number;
}

const utcDay = (ms: number): number => Math.floor(ms / MS_PER_DAY);

/** The streak after playing a week at `now` (epoch ms). Pure. */
export function advancePlayStreak(prev: Partial<PlayStreak> | undefined, now: number): PlayStreak {
  const last = typeof prev?.lastPlayTimestamp === 'number' && Number.isFinite(prev.lastPlayTimestamp)
    ? prev.lastPlayTimestamp
    : 0;
  const prevCount = typeof prev?.count === 'number' && Number.isFinite(prev.count) ? Math.max(0, prev.count) : 0;
  const hoursSince = last > 0 ? (now - last) / 3_600_000 : Infinity;

  let count: number;
  if (hoursSince < 0 || hoursSince >= PLAY_STREAK_WINDOW_HOURS || prevCount === 0) {
    // First play, a lapse, or a clock that moved backwards: start again.
    count = 1;
  } else if (utcDay(now) > utcDay(last)) {
    count = prevCount + 1; // a new day inside the window
  } else {
    count = prevCount; // same day: no advance
  }
  return {
    count,
    lastPlayTimestamp: now,
    longestStreak: Math.max(count, prev?.longestStreak ?? 0),
  };
}

/** Income bonus percent for a streak count. */
export function playStreakBonusPercent(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(count * PLAY_STREAK_BONUS_PER_DAY, PLAY_STREAK_MAX_BONUS);
}
