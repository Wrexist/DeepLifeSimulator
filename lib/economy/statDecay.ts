/**
 * Natural stat decay - the one place its numbers live.
 *
 * ── The finding (Master Program 7, 2026-09-02) ───────────────────────────
 *
 * Every week health, happiness and fitness lose a share of an "effective decay
 * rate": `base × wealth multiplier × prestige multiplier × grace ramp`. The
 * wealth multiplier was `100000 / netWorth`, clamped to **0.5-2.0**, and that
 * clamp is where the early game went wrong. Net worth reaches $50,000 - the
 * point where the ceiling stops binding - roughly nine years into a life on
 * the bottom-rung $110/week wage. So for every scenario except
 * `trust_fund_baby`, for the whole early game, the multiplier was not a
 * gradient. It was a flat ×2, and "base 4" was a number no fresh life ever
 * experienced: the rate they lived at was 8.
 *
 * Measured on the real tick (`__tests__/simulation/earlyGamePersonas.sim.test.ts`),
 * with the homeless penalty and an entry job's toll on top, that made
 * "natural decay" the single largest drain on both vitals (−4.8 health, −6.4
 * happiness a week at full grace) - larger than the two causes the player can
 * see and act on combined - and it was invisible: nothing on screen said
 * "you decay twice as fast because you are not yet rich", and nothing the
 * player could do in the first years changed it. The other two drains (no
 * home: −2/−4, an entry job: −2/−3) are named on the recap line, priced, and
 * fixable for $45 a week or a free walk.
 *
 * The ceiling is now **1.0**: wealth can slow decay (down to 0.5 above
 * $200k), it never doubles it. Base 4 is the base. What this did to the
 * five personas over 20 weeks is in `tasks/early-game-balance-2026-09-02.md`;
 * the short version is that a player who does one free fix a week goes from
 * "health 4 at week 20" to "health 35", the careful player from 61 to 96,
 * and the player who ignores every warning still dies (week 13, was 12) -
 * inaction still fails, it just fails to a slope the player was told about.
 *
 * ── Why a module rather than a constant ─────────────────────────────────
 *
 * The formula had been copied into four files (the tick, the recap
 * projection, and the two HUD breakdown modals) and two of the copies had
 * already drifted (no grace ramp, no prestige, a different net worth). The
 * advertised-vs-actual rule: one function, every reader calls it.
 */

/** Base weekly decay rate before any multiplier. Health takes ×0.6, happiness ×0.8, fitness ×0.2. */
export const STAT_DECAY_BASE_RATE = 4;

/** Weeks into a life over which decay ramps from a quarter to full rate. */
export const STAT_DECAY_GRACE_WEEKS = 8;

/** Net worth at which the wealth multiplier would be exactly 1 if it were unclamped. */
export const WEALTH_DECAY_PIVOT_USD = 100_000;

/** Floor: a fortune slows decay to half, never further. */
export const WEALTH_DECAY_MULTIPLIER_MIN = 0.5;

/**
 * Ceiling: wealth (or its absence) never SPEEDS decay. Was 2.0 - see the
 * header for why that read as a poverty penalty applied to every new life.
 */
export const WEALTH_DECAY_MULTIPLIER_MAX = 1.0;

/**
 * The wealth term of the effective decay rate.
 *
 * Total: a non-finite or non-positive net worth reads as the $1,000 floor,
 * the same guard the tick has always applied, so a corrupted save decays at
 * the ceiling rather than at NaN.
 */
export function wealthDecayMultiplier(netWorth: number): number {
  const safe = typeof netWorth === 'number' && Number.isFinite(netWorth) && netWorth > 0 ? netWorth : 1000;
  const raw = WEALTH_DECAY_PIVOT_USD / Math.max(1000, safe);
  return Math.max(WEALTH_DECAY_MULTIPLIER_MIN, Math.min(WEALTH_DECAY_MULTIPLIER_MAX, raw));
}

/** The grace ramp: 0.25 at week 0 of a life, 1.0 from week 8 on. */
export function graceRampFactor(weeksIntoLife: number): number {
  const weeks = typeof weeksIntoLife === 'number' && Number.isFinite(weeksIntoLife) ? Math.max(0, weeksIntoLife) : STAT_DECAY_GRACE_WEEKS;
  const graceFactor = Math.min(1, weeks / STAT_DECAY_GRACE_WEEKS);
  return 0.25 + 0.75 * graceFactor;
}
