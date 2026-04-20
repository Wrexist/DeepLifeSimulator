import type { GameState } from '@/contexts/game/types';
import type { AutomationRule, AutomationExecution, AutomationAction } from './automationTypes';
import { isAutomationTypeUnlocked } from './automationEngine';
import { logger } from '@/utils/logger';

/**
 * Auto-save action types
 */
export type AutoSaveActionType = 
  | 'threshold' // Save excess cash above threshold
  | 'percentage' // Save percentage of income
  | 'fixed' // Save fixed amount per week
  | 'excess'; // Save when cash exceeds X

/**
 * Execute auto-save rule
 */
export function executeAutoSave(
  rule: AutomationRule,
  state: GameState
): AutomationExecution | null {
  if (!isAutomationTypeUnlocked(state, 'save')) {
    return null;
  }
  
  const money = state.stats.money || 0;
  const bankSavings = state.bankSavings || 0;
  const actionsTaken: AutomationExecution['actionsTaken'] = [];
  
  for (const action of rule.actions) {
    try {
      const result = executeSaveAction(action, state, money, bankSavings);
      if (result) {
        actionsTaken.push({
          type: action.type,
          value: result.amount,
          result: result.success ? 'success' : 'failed',
        });
      }
    } catch (error) {
      logger.error('Auto-save action failed:', { action, error });
      actionsTaken.push({
        type: action.type,
        value: action.value,
        result: 'failed',
      });
    }
  }
  
  if (actionsTaken.length === 0) {
    return null;
  }
  
  const successCount = actionsTaken.filter(a => a.result === 'success').length;
  
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: 'save',
    executedAt: Date.now(),
    success: successCount > 0,
    message: `Saved $${actionsTaken.reduce((sum, a) => sum + a.value, 0).toLocaleString()}`,
    actionsTaken,
  };
}

/**
 * Execute a single save action
 */
function executeSaveAction(
  action: AutomationAction,
  state: GameState,
  availableCash: number,
  currentSavings: number
): { success: boolean; amount: number; message: string } | null {
  switch (action.type as AutoSaveActionType) {
    case 'threshold':
      return executeThresholdSave(action, availableCash);
    case 'percentage':
      return executePercentageSave(action, availableCash);
    case 'fixed':
      return executeFixedSave(action, availableCash);
    case 'excess':
      return executeExcessSave(action, availableCash);
    default:
      return { success: false, amount: 0, message: `Unknown action type: ${action.type}` };
  }
}

/**
 * Threshold save: Save excess cash above threshold
 */
function executeThresholdSave(
  action: AutomationAction,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const threshold = action.value;
  if (availableCash <= threshold) {
    return { success: false, amount: 0, message: `Cash ($${availableCash.toLocaleString()}) below threshold ($${threshold.toLocaleString()})` };
  }
  
  const saveAmount = availableCash - threshold;
  return {
    success: true,
    amount: saveAmount,
    message: `Saved $${saveAmount.toLocaleString()} (excess above $${threshold.toLocaleString()})`,
  };
}

/**
 * Percentage save: Save percentage of income
 */
function executePercentageSave(
  action: AutomationAction,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const percentage = Math.min(action.value, 100);
  const saveAmount = Math.floor(availableCash * (percentage / 100));
  
  if (saveAmount <= 0) {
    return { success: false, amount: 0, message: 'Insufficient cash for percentage save' };
  }
  
  return {
    success: true,
    amount: saveAmount,
    message: `Saved $${saveAmount.toLocaleString()} (${percentage}% of cash)`,
  };
}

/**
 * Fixed save: Save fixed amount per week
 */
function executeFixedSave(
  action: AutomationAction,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const saveAmount = Math.min(action.value, availableCash);
  
  if (saveAmount <= 0) {
    return { success: false, amount: 0, message: 'Insufficient cash for fixed save' };
  }
  
  return {
    success: true,
    amount: saveAmount,
    message: `Saved $${saveAmount.toLocaleString()} (fixed amount)`,
  };
}

/**
 * Excess save: Save when cash exceeds X
 */
function executeExcessSave(
  action: AutomationAction,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const threshold = action.value;
  if (availableCash <= threshold) {
    return { success: false, amount: 0, message: `Cash ($${availableCash.toLocaleString()}) does not exceed threshold ($${threshold.toLocaleString()})` };
  }
  
  const saveAmount = availableCash - threshold;
  return {
    success: true,
    amount: saveAmount,
    message: `Saved $${saveAmount.toLocaleString()} (excess above $${threshold.toLocaleString()})`,
  };
}

/**
 * Create default threshold save rule
 */
export function createDefaultThresholdSaveRule(): AutomationRule {
  return {
    id: `threshold_save_${Date.now()}`,
    type: 'save',
    name: 'Save Excess Cash',
    enabled: true,
    conditions: [
      {
        type: 'cash_above',
        value: 5000,
      },
    ],
    actions: [
      {
        type: 'threshold',
        value: 5000, // Keep $5000, save the rest
      },
    ],
    priority: 50,
  };
}

