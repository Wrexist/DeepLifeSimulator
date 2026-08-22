/**
 * Prestige bonuses that are purchasable but currently do nothing.
 *
 * FOUR have been found this way now, worth 45,000 points between them. The
 * product question each one raises — wire it, remove it, or re-purpose it — is
 * the owner's, and stays open. What this registry does is stop the shop taking
 * the points silently in the meantime.
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
export const INERT_BONUS_IDS: readonly string[] = [
  'early_item_access',
  'early_real_estate',
  'auto_manage_properties',
];

const REASONS: Record<string, string> = {
  // `legacy_business` lived here until it was given a real effect: it now pays
  // +10% family-business income per generation held, capped at +50%
  // (lib/business/familyBusinessEffects.ts). The registry was deliberately left
  // EMPTY rather than deleted — "a future dead bonus has a documented home
  // instead of needing this mechanism invented again under pressure."
  //
  // ── 2026-08-21: three more, found the same way and missed the same way ────
  //
  // `prestigeBonusReaders` passed all three, because it counts any LITERAL
  // occurrence of the id as a reader. All three have one — and in each case the
  // reader reads the id and then does nothing with it:
  //
  //   - an `if (unlockedBonuses.includes(id)) { }` whose body is two comments;
  //   - an exported `hasX()` predicate that no caller ever calls.
  //
  // That is the same blind spot as `getOperatingOverhead` (written to make the
  // passive-income soft cap visible, only ever called by its own tests) and
  // `weeklyCareerSalary` (fixed the DTI half of the annual-salary bug while six
  // screens kept printing the raw annual figure). A symbol that LOOKS like the
  // wiring is not the wiring. `prestigeBonusReaders` now checks that a
  // predicate reading a bonus id has a real, non-import caller.

  early_item_access:
    'Nothing in the game has a "premium" item tier — there is no gate for this '
    + 'to lift. The catalogue has one flat item list.',

  early_real_estate:
    'Real estate has no age requirement to lift, and every character starts at '
    + '18 or older, so "available at age 18" is already true for everyone.',

  auto_manage_properties:
    'Rent is already collected automatically for every player by the weekly '
    + 'tick. The bonus sells something you have for free.',
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
