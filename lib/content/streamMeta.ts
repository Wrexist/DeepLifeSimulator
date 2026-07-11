/**
 * Streamly channel-vitals + hype-streak helpers (pure).
 *
 * Finishes three fields the Streamly UI already renders but nothing ever wrote:
 *   - averageViewers: a rolling mean of the most-recent broadcasts' viewers.
 *   - hypeStreak: consecutive-week streaming streak that raises the hype-train
 *     chance toward a bounded ceiling (replacing the hardcoded "~8%" hint).
 *
 * No React, no state, no wall-clock — the streak is derived from `weeksLived`
 * gaps only, so ticks/actions stay idempotent per week.
 */

const safe = (n: number | undefined, fb: number): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** How many recent broadcasts feed the rolling average-viewers figure. */
export const AVG_VIEWERS_WINDOW = 10;

/** Base hype-train probability (matches the algorithm default). */
export const HYPE_BASE_CHANCE = 0.08;
/** Extra hype chance per streak week beyond the first. */
export const HYPE_STREAK_STEP = 0.03;
/** Hard ceiling on the streak-boosted hype chance (guardrail: ≤25%). */
export const HYPE_MAX_CHANCE = 0.25;

export interface ViewerRecord {
  viewers: number;
}

/**
 * Rolling mean of the most-recent `window` broadcasts' viewer counts. Accepts a
 * newest-first history (as stored) and rounds to a whole number.
 */
export function rollingAverageViewers(
  history: ReadonlyArray<ViewerRecord>,
  window: number = AVG_VIEWERS_WINDOW
): number {
  if (!history || history.length === 0) return 0;
  const w = Math.max(1, Math.floor(safe(window, AVG_VIEWERS_WINDOW)));
  const slice = history.slice(0, w);
  let sum = 0;
  for (const s of slice) sum += Math.max(0, safe(s?.viewers, 0));
  return Math.round(sum / slice.length);
}

/**
 * Next hype streak after streaming in `currentWeek`.
 *   - Same week as the last stream → streak unchanged (already counted).
 *   - Exactly the following week → streak + 1 (consecutive).
 *   - Any larger gap (or first-ever stream) → reset to 1.
 */
export function nextHypeStreak(
  prevStreak: number | undefined,
  lastStreamWeek: number | undefined,
  currentWeek: number
): number {
  const streak = Math.max(0, Math.floor(safe(prevStreak, 0)));
  const week = Math.floor(safe(currentWeek, 0));
  if (lastStreamWeek === undefined || lastStreamWeek === null) return Math.max(1, streak || 1);
  const last = Math.floor(safe(lastStreamWeek, week));
  if (last === week) return Math.max(1, streak); // already streamed this week
  if (last === week - 1) return streak + 1; // consecutive week
  return 1; // gap → reset
}

/**
 * Streak-scaled hype-train chance, clamped to [HYPE_BASE_CHANCE, HYPE_MAX_CHANCE].
 * Streak 1 → base 8%, +3%/week, capped at 25%.
 */
export function hypeChanceForStreak(streak: number): number {
  const s = Math.max(1, Math.floor(safe(streak, 1)));
  const raw = HYPE_BASE_CHANCE + HYPE_STREAK_STEP * (s - 1);
  return Math.max(HYPE_BASE_CHANCE, Math.min(HYPE_MAX_CHANCE, raw));
}
