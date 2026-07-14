/**
 * Retirement & Elder endgame — tuning constants.
 *
 * All money figures are WEEKLY dollars (the game's canonical income cadence:
 * `careers[].levels[].salary` and `lifetimeStatistics.highestSalary` are both
 * weekly in live play — see contexts/game/actions/weekly/applyLifetimeStatistics).
 *
 * Balance intent: a pension that is comfortable but clearly BELOW peak working
 * salary (never more than PENSION_SALARY_FACTOR of it), scaled by real years
 * worked, with a modest universal floor and a hard absolute cap so no runaway
 * or farm loop is possible.
 */

/** Standard age at which the "Retire" action unlocks for everyone. */
export const RETIREMENT_AGE = 65;

/**
 * Earliest age you may retire via the FINANCIAL-INDEPENDENCE path (net worth at
 * or above the FIRE number). Below this age the Retire action stays locked even
 * if rich — the elder chapter is a LATE-game arc, and this keeps a lucky-rich
 * 25-year-old from ending the game trivially.
 */
export const EARLY_RETIRE_MIN_AGE = 45;

/** Pension = base weekly salary × this factor × service fraction. < 1 by design. */
export const PENSION_SALARY_FACTOR = 0.6;

/** Years worked needed for a FULL (100%) service fraction. Fewer years ⇒ pro-rata. */
export const FULL_PENSION_YEARS = 35;

/**
 * Minimum weeks worked to qualify for the SOCIAL_SECURITY_FLOOR. Someone who
 * never really worked gets only the pro-rata pension (often ~$0), not the floor.
 */
export const MIN_PENSION_QUALIFY_WEEKS = 52;

/** Universal minimum weekly pension for anyone who worked ≥ MIN_PENSION_QUALIFY_WEEKS. */
export const SOCIAL_SECURITY_FLOOR = 120;

/** Hard ceiling on the weekly pension — the final anti-runaway safety clamp. */
export const PENSION_WEEKLY_ABS_CAP = 5000;

/**
 * Sanity ceiling on the weekly-salary BASE fed into the pension formula. Higher
 * than any authored career ladder, so it never bites in normal play, but bounds
 * the pension if a corrupted/oversized `highestSalary` ever slips through.
 */
export const PENSION_BASE_SALARY_CAP = 25000;
