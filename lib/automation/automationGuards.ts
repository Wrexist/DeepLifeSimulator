import type { GameState } from '@/contexts/game/types';
import type { AutomationRule } from './automationTypes';

/**
 * Check if automation bonuses are unlocked
 */
export function hasAutomationBonus(state: GameState, bonusId: string): boolean {
  const unlockedBonuses = state.prestige?.unlockedBonuses || [];
  return unlockedBonuses.includes(bonusId);
}

/**
 * Get maximum automation slots
 */
export function getMaxAutomationSlots(state: GameState): number {
  const unlockedBonuses = state.prestige?.unlockedBonuses || [];
  let slots = 1; // Base slot

  // Count how many times automation_slot_1 was purchased (maxLevel 5)
  const slotCount = unlockedBonuses.filter(id => id === 'automation_slot_1').length;
  slots += slotCount;

  return slots;
}

/**
 * Check if a specific automation type is unlocked
 */
export function isAutomationTypeUnlocked(state: GameState, type: AutomationRule['type']): boolean {
  switch (type) {
    case 'invest':
      return hasAutomationBonus(state, 'automation_auto_invest');
    case 'save':
      return hasAutomationBonus(state, 'automation_auto_save');
    case 'pay':
      return hasAutomationBonus(state, 'automation_auto_pay');
    case 'renew':
      return hasAutomationBonus(state, 'automation_auto_renew');
    default:
      return false;
  }
}
