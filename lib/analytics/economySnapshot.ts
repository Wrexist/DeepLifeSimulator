/**
 * Economy telemetry — a pure, sampled week-boundary rollup.
 *
 * WHY A ROLLUP AND NOT PER-TRANSACTION EVENTS. The obvious design is an event
 * per money movement, and it is the wrong one here for two independent reasons.
 * The transport is a capped 200-event queue on a device (`AnalyticsService`), so
 * a player who advances thirty weeks in a sitting would evict their own session
 * and paywall events to make room for grocery purchases. And the money path is
 * the hottest in the app — `applyMoneyDelta` runs inside `setGameState`
 * updaters (CLAUDE.md §4.4) — so instrumenting it puts analytics work inside
 * the one place this repo has repeatedly measured for performance. A rollup
 * costs one event per sample and reads values the save is already keeping.
 *
 * WHAT IT CAN AND CANNOT ANSWER. It answers the questions that decide whether
 * the economy is healthy: is money entering faster than it leaves (inflation),
 * is the balance distribution drifting, is net worth growing at a rate the
 * design intends, and — the tail of that same distribution — is anyone growing
 * at a rate the design does NOT intend (§20). It does NOT attribute a flow to a
 * specific source or sink, because the save keeps only the two cumulative
 * totals. Per-source attribution would need a ledger, which is a save-format
 * change; the honest position is that this measures the economy's *aggregate*
 * health, and `docs/ANALYTICS.md` records the limitation rather than implying
 * a breakdown that does not exist.
 *
 * WHY SAMPLED. One event per game week would be ~100 events for a single long
 * session, which is the queue problem above in slower motion. The sample is one
 * in-game MONTH (four weeks — the same cadence `gameState.week` cycles on), and
 * the deltas are computed against the previous SAMPLE, not the previous week,
 * so nothing is lost: the totals still tile the whole life with no gaps.
 *
 * NEVER READS THE DEVICE CLOCK. Every quantity here is denominated in game
 * weeks. Five `STATE_VERSION` bumps in this repo exist because a wall-clock
 * gate was farmable (v28/v31/v35/v40/v44); nothing is paid out here, but a
 * wall-clock rate would additionally make the numbers meaningless — a player who
 * backgrounds the app for a day has not experienced a day of in-game economy.
 */

/** Sample cadence, in game weeks. One in-game month. */
export const ECONOMY_SAMPLE_WEEKS = 4;

/** The cumulative counters a sample is taken from. */
export interface EconomySample {
  /** `lifetimeStatistics.totalMoneyEarned` — monotonic within a life. */
  totalEarned: number;
  /** `lifetimeStatistics.totalMoneySpent` — monotonic within a life. */
  totalSpent: number;
  /** `stats.money`, the liquid balance. */
  money: number;
  /** Computed net worth (assets − liabilities). */
  netWorth: number;
  /** Weeks into the CURRENT life. Never raw `weeksLived` — CLAUDE.md §4.2. */
  weeksThisLife: number;
}

/** What one sample reports, ready to attach to an `economy_week` event. */
export interface EconomyRollup {
  /** Money that ENTERED since the previous sample (a source total). */
  earned: number;
  /** Money that LEFT since the previous sample (a sink total). */
  spent: number;
  /** `earned - spent`. Persistently positive across the population is inflation. */
  netFlow: number;
  /** Liquid balance at the sample. */
  money: number;
  /** Net worth at the sample. */
  netWorth: number;
  /** Net worth added per game week since the previous sample. */
  netWorthPerWeek: number;
  /** Money earned per game week since the previous sample. */
  earnedPerWeek: number;
  /** Weeks into the current life at the sample. */
  weeksThisLife: number;
  /** Game weeks this rollup covers. */
  spanWeeks: number;
}

const finite = (value: number, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** True when `weeksThisLife` lands on a sample boundary. */
export function isEconomySampleWeek(weeksThisLife: number): boolean {
  const weeks = finite(weeksThisLife, -1);
  if (weeks < 0) return false;
  return weeks % ECONOMY_SAMPLE_WEEKS === 0;
}

/**
 * Difference two samples into a rollup.
 *
 * `previous` is null for the first sample of a life, which reports the totals
 * so far rather than nothing: a player who installs and reaches week 4 has an
 * economy, and dropping their first rollup would systematically exclude the
 * shortest lives — precisely the ones a retention question is about.
 *
 * Deltas are floored at zero. The cumulative counters are monotonic WITHIN a
 * life, but a prestige or a death resets them, so an un-floored subtraction
 * across that boundary would report a large negative "earning" and drag the
 * population mean somewhere no player has ever been. Floor, and let the
 * `spanWeeks` reset make the boundary visible instead.
 */
export function diffEconomySamples(
  previous: EconomySample | null,
  current: EconomySample,
): EconomyRollup {
  const currentWeeks = Math.max(0, finite(current.weeksThisLife));
  const previousWeeks = previous ? Math.max(0, finite(previous.weeksThisLife)) : 0;
  // A life reset can move `weeksThisLife` backwards; the span is then the
  // current life's own weeks, not a negative number.
  const spanWeeks = Math.max(0, currentWeeks - previousWeeks) || currentWeeks;

  const earned = Math.max(0, finite(current.totalEarned) - (previous ? finite(previous.totalEarned) : 0));
  const spent = Math.max(0, finite(current.totalSpent) - (previous ? finite(previous.totalSpent) : 0));
  const netWorth = finite(current.netWorth);
  const netWorthDelta = netWorth - (previous ? finite(previous.netWorth) : 0);

  // Per-week rates are the comparable quantities: a rollup covering 4 weeks and
  // one covering 40 (a player who closed the app mid-life and came back) are
  // otherwise incomparable, and averaging their totals is how a "spike" that is
  // really a long gap ends up in an anomaly report.
  const divisor = spanWeeks > 0 ? spanWeeks : 1;

  return {
    earned,
    spent,
    netFlow: earned - spent,
    money: finite(current.money),
    netWorth,
    netWorthPerWeek: Math.round(netWorthDelta / divisor),
    earnedPerWeek: Math.round(earned / divisor),
    weeksThisLife: currentWeeks,
    spanWeeks,
  };
}
