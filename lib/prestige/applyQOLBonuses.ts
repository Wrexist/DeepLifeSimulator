import { getEventFrequencyBoost } from './applyBonuses';

/**
 * Quality of Life bonus flags
 */
export interface QOLBonuses {
  autoSaveEnergy: boolean;
  autoManageProperties: boolean;
  autoInvestDividends: boolean;
  increasedEnergyRegen: boolean;
  reducedEventFrequency: boolean;
}

/**
 * Get active QoL bonuses from unlocked bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns QoL bonus flags
 */
export function getQOLBonuses(unlockedBonuses: string[]): QOLBonuses {
  return {
    autoSaveEnergy: unlockedBonuses.includes('auto_save_energy'),
    autoManageProperties: unlockedBonuses.includes('auto_manage_properties'),
    autoInvestDividends: unlockedBonuses.includes('auto_invest_dividends'),
    increasedEnergyRegen: unlockedBonuses.includes('increased_energy_regen'),
    reducedEventFrequency: unlockedBonuses.includes('reduced_event_frequency'),
  };
}

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

/**
 * Check if auto-collect rent should trigger
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns True if auto-collect should trigger
 */
export function shouldAutoCollectRent(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('auto_manage_properties');
}

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

