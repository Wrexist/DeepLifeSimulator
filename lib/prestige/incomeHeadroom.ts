/**
 * How much of a prestige income bonus the player would actually receive.
 *
 * `getIncomeMultiplier` clamps the combined income bonuses to
 * `INCOME_MULTIPLIER_CAP` (1.5 = +50%). The cap is deliberate — uncapped
 * stacking makes each prestige cycle faster than the last — but nothing
 * surfaced it. `PrestigeShopModal` renders `bonus.description` verbatim, so
 * every card promised its headline number no matter how little room was left:
 *
 *   fully stacked, the bonuses advertise  3.35x (+235%)
 *   the player actually receives          1.50x  (+50%)
 *
 * Headroom is +0.50, and three levels of Small (+0.15) plus three of Moderate
 * (+0.30) already reach +0.45. After that *Wealth Magnet* — 40,000 points,
 * "+100% passive income" — grants exactly zero while the shop still shows
 * "+100%". Same class as the MON findings in this PR: a purchase consumed for
 * nothing.
 *
 * Nothing here changes the cap. It makes the cap legible so the choice stays
 * the player's.
 *
 * Both functions answer by ASKING `getIncomeMultiplier` rather than
 * reimplementing the sum. A second copy of that arithmetic is the recurring
 * defect in this codebase, and it would be especially bad here: the display
 * would drift the moment a bonus is retuned.
 */
import { INCOME_MULTIPLIER_CAP, getIncomeMultiplier } from './applyBonuses';

const safeList = (unlockedBonuses: string[] | undefined | null): string[] =>
  Array.isArray(unlockedBonuses) ? unlockedBonuses : [];

export interface IncomeHeadroom {
  /** The multiplier in force right now (what the week loop applies). */
  current: number;
  /** The ceiling. */
  cap: number;
  /** How much more multiplier can still be gained. 0 once capped. */
  remaining: number;
  /** True when no further income bonus can do anything. */
  atCap: boolean;
}

export function incomeMultiplierHeadroom(
  unlockedBonuses: string[] | undefined | null,
): IncomeHeadroom {
  const current = getIncomeMultiplier(safeList(unlockedBonuses));
  const remaining = Math.max(0, INCOME_MULTIPLIER_CAP - current);
  return {
    current,
    cap: INCOME_MULTIPLIER_CAP,
    remaining,
    atCap: remaining <= 0,
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
  // "Would it do anything on a clean slate?" separates an income bonus from a
  // learning-speed one without hardcoding a list of ids that could go stale.
  const affectsIncome = getIncomeMultiplier([bonusId]) > getIncomeMultiplier([]);
  return affectsIncome && incomeGainFromPurchase(unlockedBonuses, bonusId) <= 0;
}
