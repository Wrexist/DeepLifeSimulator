/**
 * Trending topics (YouVideo). A weekly-rotating "hot topic" is picked
 * deterministically from the composer's topic pool so a matching upload earns
 * the already-wired (and pre-clamped 0..0.5) `trendBonus` reach boost.
 *
 * Pure + deterministic: the pick is a function of `week` only — no wall-clock,
 * no stored state, so it needs no new save field and is idempotent per week.
 * The reach bonus itself is clamped inside `projectVideoOutcome`, so this file
 * only decides WHICH topic is hot and HOW big the (bounded) bonus is.
 */

const safe = (n: number | undefined, fb: number): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * Reach bonus granted to an upload whose topic matches the week's trend.
 * `projectVideoOutcome` re-clamps to 0..0.5; keep this within that band.
 */
export const TRENDING_TOPIC_BONUS = 0.5;

/**
 * Deterministically pick the hot topic for a given week from a topic pool.
 * Same `week` + same pool → same topic (tick-safe). Empty pool → ''.
 */
export function trendingTopicForWeek(week: number, topics: readonly string[]): string {
  if (!topics || topics.length === 0) return '';
  const w = Math.max(0, Math.floor(safe(week, 0)));
  // A small integer mix so consecutive weeks rotate rather than repeating; the
  // multiplier is coprime-ish with typical small pool sizes to spread picks.
  const idx = ((w * 7 + 3) % topics.length + topics.length) % topics.length;
  return topics[idx];
}

/**
 * The bounded trend bonus for an upload: the full bonus when the chosen topic
 * is this week's trend, otherwise 0. Kept ≤ TRENDING_TOPIC_BONUS.
 */
export function trendBonusForTopic(
  chosenTopic: string,
  week: number,
  topics: readonly string[]
): number {
  if (!chosenTopic) return 0;
  return trendingTopicForWeek(week, topics) === chosenTopic ? TRENDING_TOPIC_BONUS : 0;
}
