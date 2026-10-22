/**
 * How Legacy Points accrue from living - the one definition (LATE-1).
 *
 * Owner decision 2026-10-22: a FLAT grant keyed on weeks PLAYED in this life
 * (`weeksInThisLife`), not on the absolute `weeksLived` counter.
 *
 * The tick used to grant `floor(weeksLived / 10) + prestigeLevel * 2` every
 * ten weeks. `weeksLived` is absolute and seeded from the starting age (§4.2),
 * so the per-grant amount grew with the counter and the total grew with its
 * SQUARE: an 18 -> 65 life earned 29,890 LP and an 18 -> 80 life 52,003,
 * against a 9,160 LP Dynasty Tree. One ordinary life bought the whole tree,
 * including $111M of heir starting cash, and the Endowment, Contracts and
 * Trials (the long-horizon economy) stopped mattering.
 *
 * Now every 10 played weeks pays `LEGACY_POINTS_PER_GRANT` plus
 * `LEGACY_POINTS_PER_PRESTIGE_LEVEL` per prestige level. At prestige 0 an
 * 18 -> 65 life (2,444 weeks) earns 244 x 2 = 488 LP, so the tree takes many
 * lives, and the other LP sources are worth chasing again.
 *
 * Every screen that describes the rate reads `describeLegacyAccrual`, so the
 * copy cannot drift from what the tick applies.
 */

/** A grant lands once per this many PLAYED weeks. */
export const LEGACY_GRANT_INTERVAL_WEEKS = 10;
/** Flat Legacy Points per grant. */
export const LEGACY_POINTS_PER_GRANT = 2;
/** Extra Legacy Points per grant for each prestige level. */
export const LEGACY_POINTS_PER_PRESTIGE_LEVEL = 1;

function safeLevel(prestigeLevel: unknown): number {
  return typeof prestigeLevel === 'number' && Number.isFinite(prestigeLevel) && prestigeLevel > 0
    ? Math.floor(prestigeLevel)
    : 0;
}

/** Points one grant pays at this prestige level. */
export function legacyPointsPerGrant(prestigeLevel: unknown): number {
  return LEGACY_POINTS_PER_GRANT + safeLevel(prestigeLevel) * LEGACY_POINTS_PER_PRESTIGE_LEVEL;
}

/**
 * Legacy Points earned by reaching `playedWeeks` (weeks into THIS life) on
 * this tick: a grant on every 10th played week, 0 otherwise.
 */
export function legacyPointsEarnedThisWeek(playedWeeks: unknown, prestigeLevel: unknown): number {
  if (typeof playedWeeks !== 'number' || !Number.isFinite(playedWeeks) || playedWeeks <= 0) return 0;
  const week = Math.floor(playedWeeks);
  if (week % LEGACY_GRANT_INTERVAL_WEEKS !== 0) return 0;
  return legacyPointsPerGrant(prestigeLevel);
}

/** Total accrual over `playedWeeks` at a fixed prestige level. */
export function legacyPointsForPlayedWeeks(playedWeeks: number, prestigeLevel: unknown): number {
  if (!Number.isFinite(playedWeeks) || playedWeeks <= 0) return 0;
  return Math.floor(playedWeeks / LEGACY_GRANT_INTERVAL_WEEKS) * legacyPointsPerGrant(prestigeLevel);
}

/** Player-facing rate, e.g. "+2 legacy points every 10 weeks you live". */
export function describeLegacyAccrual(prestigeLevel: unknown): string {
  return `+${legacyPointsPerGrant(prestigeLevel)} legacy points every ${LEGACY_GRANT_INTERVAL_WEEKS} weeks you live`;
}
