/**
 * Prestige bonuses that are purchasable but currently do nothing.
 *
 * A scan of all 50 catalogue ids against every source file found exactly one
 * with no reader anywhere in game logic: `legacy_business`.
 *
 *   Family Business Legacy · legendary · 30,000 points
 *   "Future generations inherit family businesses"
 *
 * Family businesses are inherited UNCONDITIONALLY — `prestigeExecution.ts`
 * carries `familyBusinesses[]` and their companies to the heir under a comment
 * reading "BUG FIX: Preserve family businesses on prestige", with no reference
 * to the bonus. The purchase is consumed and changes nothing.
 *
 * This registry exists so the shop can say so before the player pays. It is
 * deliberately NOT a fix for the underlying product question, which is a
 * genuine choice and not mine to make:
 *
 *   - Gating inheritance on the bonus would remove behaviour every existing
 *     player has today, and undo a deliberate bug fix.
 *   - Deleting the bonus strands the points of anyone who already bought it.
 *   - Giving it a new additive effect is designing a feature, not auditing one.
 *
 * Being a hand-maintained list is a real limitation, so it is worth stating:
 * this catches what has been VERIFIED inert, not everything that might be. The
 * accompanying suite asserts each listed id still exists in the catalogue and
 * that `legacy_business` is still ungated, so an entry cannot silently go stale
 * or keep warning about a bonus somebody has since wired up.
 */

/** Bonus ids verified to have no effect in game logic. */
export const INERT_BONUS_IDS: readonly string[] = ['legacy_business'];

const REASONS: Record<string, string> = {
  legacy_business:
    'Family businesses already pass to your heir without this',
};

/**
 * A short explanation when a bonus does nothing, or `null` when it works.
 * Null for every unknown id, so a bonus added later is assumed functional
 * rather than smeared as broken.
 */
export function inertBonusReason(bonusId: string): string | null {
  return REASONS[bonusId] ?? null;
}

export function isInertBonus(bonusId: string): boolean {
  return inertBonusReason(bonusId) !== null;
}
