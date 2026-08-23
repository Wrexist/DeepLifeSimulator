/**
 * How much of a prestige income bonus the player would actually receive.
 *
 * `getIncomeMultiplier` runs the combined income bonuses through a SOFT cap:
 * full effect to +50%, 25% effectiveness beyond it, hard ceiling at
 * `INCOME_MULTIPLIER_CAP` (2.0x). See the curve's rationale in
 * `applyBonuses.ts` — it replaced a hard clamp at 1.5 that consumed every
 * point spent past the wall for nothing.
 *
 * This module is what keeps the shop honest about that curve: the card notes
 * and the banner state what a purchase would ACTUALLY add, which past the soft
 * cap is a quarter of the headline number.
 *
 * Both functions answer by ASKING `getIncomeMultiplier` rather than
 * reimplementing the sum. A second copy of that arithmetic is the recurring
 * defect in this codebase, and it would be especially bad here: the display
 * would drift the moment a bonus is retuned.
 */
import {
  INCOME_MULTIPLIER_CAP,
  INCOME_SOFT_CAP,
  getIncomeMultiplier,
  getRawIncomeMultiplier,
} from './applyBonuses';

const safeList = (unlockedBonuses: string[] | undefined | null): string[] =>
  Array.isArray(unlockedBonuses) ? unlockedBonuses : [];

export interface IncomeHeadroom {
  /** The multiplier in force right now (what the week loop applies). */
  current: number;
  /** The absolute ceiling. */
  cap: number;
  /** The full-effect threshold — bonuses past it apply at reduced rate. */
  softCap: number;
  /** How much more multiplier can still be gained before the hard cap. */
  remaining: number;
  /** True when no further income bonus can do anything (hard ceiling). */
  atCap: boolean;
  /**
   * True once the RAW sum has passed the soft cap — from here on, every
   * further income bonus applies at the reduced rate.
   */
  diminished: boolean;
}

export function incomeMultiplierHeadroom(
  unlockedBonuses: string[] | undefined | null,
): IncomeHeadroom {
  const owned = safeList(unlockedBonuses);
  const current = getIncomeMultiplier(owned);
  const remaining = Math.max(0, INCOME_MULTIPLIER_CAP - current);
  return {
    current,
    cap: INCOME_MULTIPLIER_CAP,
    softCap: INCOME_SOFT_CAP,
    remaining,
    atCap: remaining <= 0,
    diminished: getRawIncomeMultiplier(owned) > INCOME_SOFT_CAP,
  };
}

/**
 * The multiplier a purchase would really add — the full amount while there is
 * room, only the remaining headroom when it overflows, and 0 at the cap.
 *
 * Returns 0 for bonuses that do not affect income at all (e.g. `genius`), so a
 * caller can distinguish "capped out" from "not an income bonus" and avoid
 * warning about a card the cap has nothing to do with. A false warning is how
 * a real one stops being read.
 */
export function incomeGainFromPurchase(
  unlockedBonuses: string[] | undefined | null,
  bonusId: string,
): number {
  const owned = safeList(unlockedBonuses);
  const before = getIncomeMultiplier(owned);
  const after = getIncomeMultiplier([...owned, bonusId]);
  return Math.max(0, after - before);
}

/**
 * True when this bonus WOULD raise income but the cap leaves it nothing to
 * give. False for non-income bonuses, which are unaffected by the cap.
 */
export function isIncomeBonusWasted(
  unlockedBonuses: string[] | undefined | null,
  bonusId: string,
): boolean {
  const owned = safeList(unlockedBonuses);
  // Two separate questions, and they need two different multipliers.
  //
  // "Is this an income bonus at all?" must be asked of the UNCAPPED sum, and
  // against what the player already owns. The previous version asked it of the
  // CAPPED sum on a CLEAN SLATE — `getIncomeMultiplier([bonusId]) >
  // getIncomeMultiplier([])` — which is false for any bonus whose contribution
  // has a prerequisite. `synergy_wealth_master` pays +15% only once two income
  // bonuses are owned, so on an empty list it looked like a non-income bonus and
  // was exempted from the cap warning entirely: an 18,000-point epic, sold with
  // no warning in exactly the situation where the cap eats all of it. Asking
  // against `owned` rather than a clean slate is what makes the probe track the
  // prerequisite: a player who does not yet own two income bonuses gets no cap
  // note at all (correct — the cap is not what is stopping them; the card's own
  // description already states the requirement), and the moment they do, the
  // synergy is classified as the income bonus it is.
  //
  // "Would buying it move the paycheck?" is then asked of the CAPPED sum, which
  // is what the week loop applies.
  const affectsIncome =
    getRawIncomeMultiplier([...owned, bonusId]) > getRawIncomeMultiplier(owned);
  return affectsIncome && incomeGainFromPurchase(owned, bonusId) <= 0;
}
