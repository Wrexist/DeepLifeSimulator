import type { GameState } from '@/contexts/game/types';
import type { AutomationRule, AutomationExecution, AutomationState } from './automationTypes';
import { executeAutoPay } from './autoPay';
import { executeAutoRenew } from './autoRenew';
import { executeAutoInvest } from './autoInvest';
import { logger } from '@/utils/logger';

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

/**
 * Check if automation is enabled globally
 */
export function isAutomationEnabled(state: GameState): boolean {
  const automation = state.automation;
  if (!automation) return false;
  
  // Check if at least one automation bonus is unlocked
  const hasAnyBonus = 
    hasAutomationBonus(state, 'automation_auto_invest') ||
    hasAutomationBonus(state, 'automation_auto_save') ||
    hasAutomationBonus(state, 'automation_auto_pay') ||
    hasAutomationBonus(state, 'automation_auto_renew');
  
  return hasAnyBonus && (automation.enabled !== false);
}

/**
 * Evaluate automation conditions
 */
export function evaluateConditions(
  conditions: AutomationRule['conditions'],
  state: GameState
): boolean {
  if (conditions.length === 0) return true;
  
  const money = state.stats.money || 0;
  const week = state.weeksLived || 0;
  
  for (const condition of conditions) {
    let result = false;
    
    switch (condition.type) {
      case 'cash_above':
        result = money > condition.value;
        break;
      case 'cash_below':
        result = money < condition.value;
        break;
      case 'cash_percentage':
        // This would need total assets, simplified for now
        result = money > condition.value;
        break;
      case 'income_received':
        // Check if player has a job with positive salary (income source exists)
        result = (state.job?.salary || 0) > 0 || (state.company?.weeklyIncome || 0) > 0;
        break;
      case 'week_number':
        result = week >= condition.value;
        break;
      case 'always':
        result = true;
        break;
      default:
        result = false;
    }
    
    // If any condition fails, rule doesn't trigger
    if (!result) return false;
  }
  
  return true;
}

/**
 * Process automation rules for the week
 */
export function processAutomationRules(state: GameState): AutomationExecution[] {
  const executions: AutomationExecution[] = [];
  
  // Check if automation is enabled
  if (!isAutomationEnabled(state)) {
    return executions;
  }
  
  const automation = state.automation;
  if (!automation || !automation.rules) {
    return executions;
  }
  
  // Get enabled rules, sorted by priority
  const enabledRules = automation.rules
    .filter(rule => rule.enabled)
    .sort((a, b) => b.priority - a.priority);
  
  // Check slot limits
  const maxSlots = getMaxAutomationSlots(state);
  const activeRules = enabledRules.slice(0, maxSlots);
  
  // Process each rule
  for (const rule of activeRules) {
    // Check if rule type is unlocked
    if (!isAutomationTypeUnlocked(state, rule.type)) {
      continue;
    }
    
    // Evaluate conditions
    if (!evaluateConditions(rule.conditions, state)) {
      continue;
    }
    
    // Execute rule (delegated to specific automation modules)
    try {
      const execution = executeAutomationRule(rule, state);
      if (execution) {
        executions.push(execution);
      }
    } catch (error) {
      logger.error('Failed to execute automation rule:', { ruleId: rule.id, error });
      executions.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        executedAt: Date.now(),
        success: false,
        message: `Execution failed: ${error}`,
        actionsTaken: [],
      });
    }
  }
  
  return executions;
}

/**
 * Execute a single automation rule by dispatching to the correct module
 */
function executeAutomationRule(
  rule: AutomationRule,
  state: GameState
): AutomationExecution | null {
  switch (rule.type) {
    case 'pay':
      return executeAutoPay(rule, state);
    case 'renew':
      return executeAutoRenew(rule, state);
    case 'invest':
      return executeAutoInvest(rule, state);
    case 'save':
      // Auto-save: calculate amount to set aside from cash
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        executedAt: Date.now(),
        success: true,
        message: `Saved per rule ${rule.name}`,
        actionsTaken: rule.actions.map(action => ({
          type: action.type,
          value: action.value,
          result: 'success' as const,
        })),
      };
    default:
      logger.warn(`Unknown automation rule type: ${rule.type}`);
      return null;
  }
}

/**
 * Validate automation rule
 */
export function validateAutomationRule(rule: AutomationRule, state: GameState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check if rule type is unlocked
  if (!isAutomationTypeUnlocked(state, rule.type)) {
    errors.push(`Automation type '${rule.type}' is not unlocked. Purchase the required prestige bonus.`);
  }
  
  // Check slot limits
  const automation = state.automation;
  if (automation) {
    const enabledRules = automation.rules.filter(r => r.enabled && r.id !== rule.id);
    const maxSlots = getMaxAutomationSlots(state);
    if (enabledRules.length >= maxSlots && rule.enabled) {
      errors.push(`Maximum automation slots (${maxSlots}) reached. Purchase additional slots in the prestige shop.`);
    }
  }
  
  // Validate conditions
  if (rule.conditions.length === 0) {
    errors.push('Rule must have at least one condition.');
  }
  
  // Validate actions
  if (rule.actions.length === 0) {
    errors.push('Rule must have at least one action.');
  }
  
  // Validate priority
  if (rule.priority < 0 || rule.priority > 100) {
    errors.push('Priority must be between 0 and 100.');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create default automation state
 */
export function createDefaultAutomationState(): AutomationState {
  return {
    rules: [],
    executionHistory: [],
    maxSlots: 1,
    enabled: true,
  };
}

