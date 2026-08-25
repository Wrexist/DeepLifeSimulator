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
import { calculateIncomeTax } from './constants';

/**
 * Cap on the income that qualifies as the BASE of the lucky-bonus and
 * play-streak multipliers (2026-08-25 economy audit).
 *
 * Both engagement bonuses multiply `careerSalary + passiveIncome`, so with no
 * cap they scaled with the whole late-game economy: at $500k/wk of income the
 * 1% jackpot was a $5M tap, dwarfing every authored reward in the game and
 * sitting outside the $10M net-worth passive soft cap. The cap re-uses the
 * per-source-cap idiom (`PER_SOURCE_CAPS` in passiveIncome.ts) and is set at
 * the top income-tax threshold: below $25k/wk — every early/mid-game player —
 * nothing changes; above it the jackpot stays a meaningful $250k, not a
 * fortune. Multipliers and probabilities are untouched.
 */
export const ENGAGEMENT_BONUS_BASE_CAP = 25_000;

/**
 * Withhold income tax on an engagement bonus (lucky bonus / play streak).
 *
 * The bonuses are credited AFTER the week's tax line has already been
 * computed, so they used to be the only recurring income in the game that was
 * never taxed — an unpriced +30-50% channel that bypassed the one mandatory
 * sink that scales with wealth. This charges exactly the MARGINAL tax the
 * canonical brackets would have charged had the bonus been in the base
 * (`calculateIncomeTax(base + bonus) − calculateIncomeTax(base)`), scaled by
 * the same Tax Strategy multiplier the main line applies — one tax formula,
 * no second copy.
 *
 * Returns the NET amount to credit (never negative).
 */
export function netEngagementBonus(
  grossBonus: number,
  taxableBaseIncome: number,
  taxMult: number = 1,
): number {
  if (!isFinite(grossBonus) || grossBonus <= 0) return 0;
  const base = isFinite(taxableBaseIncome) && taxableBaseIncome > 0 ? taxableBaseIncome : 0;
  const safeMult = isFinite(taxMult) && taxMult > 0 ? taxMult : 1;
  const marginalTax =
    (calculateIncomeTax(base + grossBonus) - calculateIncomeTax(base)) * safeMult;
  const net = Math.round(grossBonus - Math.max(0, marginalTax));
  return net > 0 ? net : 0;
}

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
