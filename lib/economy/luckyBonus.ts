/**
 * The weekly luck seed — deterministic, and finally actually varied.
 *
 * The lucky-bonus roll in the week loop used `(weeksLived * 777 + 42) % 100`.
 * 777 ≡ 77 (mod 100) and gcd(77, 100) = 1, so that expression is a fixed
 * PERMUTATION of 0..99 with period exactly 100: every player, every life and
 * every save hit the same "lucky" weeks on the same evenly-spaced public
 * schedule — rare weeks never clustered, never drifted, and a player who
 * noticed could write the schedule down (2026-08-24 gameplay audit).
 *
 * This routes the same contract (deterministic per week, so StrictMode's
 * double-invoked updater and a reload agree, and save-scumming a week cannot
 * reroll it) through the audited seeded RNG the event engine uses, salted
 * per-life so two lives do not share a luck timeline.
 *
 * Pure; lives in lib so it is testable without mounting the week loop.
 */
import { makeWeeklyRoll } from '@/utils/seededRoll';

/** Uniform integer 0..99 for the given absolute week of the given life. */
export function rollWeeklyLuckSeed(
  weeksLived: number,
  lineageId: string | undefined,
  generationNumber: number | undefined
): number {
  const roll = makeWeeklyRoll(weeksLived || 0)(
    `lucky-bonus:${lineageId || ''}:${generationNumber || 1}`
  );
  return Math.min(99, Math.floor(roll * 100));
}
