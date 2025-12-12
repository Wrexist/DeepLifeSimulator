import { GameState } from '@/contexts/game/types';

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
  if (unlockedBonuses.includes('reduced_event_frequency')) {
    return 0.7; // -30% negative events
  }
  return 1.0;
}

