import { getEventFrequencyBoost } from './applyBonuses';

/*
 * DELETED 2026-08-21: `QOLBonuses` and `getQOLBonuses`.
 *
 * A five-field flag object assembled from five bonus ids, with no callers
 * anywhere. Four of those ids have real readers further down this file; the
 * fifth (`auto_manage_properties`) does not, and this aggregate was the only
 * thing making it look otherwise.
 */

/**
 * Check if auto-rest should trigger
 * @param energy Current energy level
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns True if auto-rest should trigger
 */
export function shouldAutoRest(energy: number, unlockedBonuses: string[]): boolean {
  if (!unlockedBonuses.includes('auto_save_energy')) return false;
  return energy < 20; // Auto-rest when energy < 20%
}

/*
 * DELETED 2026-08-21: `shouldAutoCollectRent`.
 *
 * Imported by `MoneyActionsContext` and never called — so the 5,000-point
 * "Property Manager" bonus it fronted did nothing. It could not have done much
 * anyway: rent is collected for EVERY player by the weekly tick
 * (`applyRentAndHousing` → `runRealEstateWeeklyTick`), so the bonus sells
 * something that is already free. Same shape as `legacy_business`, which sold
 * an inheritance that already happened unconditionally. It is registered in
 * `lib/prestige/inertBonuses.ts`; wiring it would mean taking automatic rent
 * away from everyone who does not own it, which is a product decision, not a
 * bug fix.
 */

/**
 * Check if auto-reinvest dividends should trigger
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns True if auto-reinvest should trigger
 */
export function shouldAutoReinvestDividends(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('auto_invest_dividends');
}

/**
 * Get event frequency modifier
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Event frequency multiplier (1.0 = normal, 0.7 = 30% reduction)
 */
export function getEventFrequencyModifier(unlockedBonuses: string[]): number {
  let modifier = 1.0;
  
  // Reduced negative event frequency
  if (unlockedBonuses.includes('reduced_event_frequency')) {
    modifier *= 0.7; // -30% negative events
  }
  
  /**
   * R3-P4: "Eventful Life" (5,000 pts, 2 levels) used to be computed into a
   * local variable and dropped on the floor.
   *
   *     const boost = getEventFrequencyBoost(unlockedBonuses);
   *     // Apply boost only to positive events (this is handled in event engine)
   *     return modifier;
   *
   * `boost` was assigned and never read, and the deferral was to code that does
   * not exist: `getEventFrequencyBoost` has no other call site, and the engine
   * applies only this returned `modifier` to a single `baseEventChance`. So
   * 17,500 points for both levels changed nothing.
   *
   * SCOPE NOTE, because the shop copy overpromises: events carry no
   * positive/negative tag anywhere in `lib/events/engine.ts`, so there is no
   * lever to raise positive events specifically. The only effect the engine can
   * express is overall event frequency, which is what the bonus is NAMED for.
   * A player who owns both this and `reduced_event_frequency` gets the two
   * partially offsetting, which is coherent. Re-wording the shop description
   * from "+25% positive event frequency" to "+25% event frequency" is a copy
   * change for the owner, recorded in the round 3 findings file.
   */
  modifier *= getEventFrequencyBoost(unlockedBonuses);

  return modifier;
}

