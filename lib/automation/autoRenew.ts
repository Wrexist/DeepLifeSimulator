import type { GameState } from '@/contexts/game/types';
import type { AutomationRule, AutomationExecution, AutomationAction } from './automationTypes';
import { isAutomationTypeUnlocked } from './automationGuards';
import { logger } from '@/utils/logger';

/**
 * Auto-renew action types
 */
export type AutoRenewActionType = 
  | 'renew_subscription' // Renew subscription
  | 'renew_insurance' // Renew insurance
  | 'renew_all'; // Renew all expiring items

/**
 * Execute auto-renew rule.
 *
 * IMPORTANT: this planner only computes intended renewal costs and records them
 * to `automation.executionHistory`; it does NOT charge the player or extend any
 * subscription/insurance expiry. The apply-site in GameActionsContext records
 * auto-renew to history only. So the result messages use "Would renew …" intent
 * framing, not "Renewed …", to stay honest.
 * TODO(flawless-audit): apply-site wiring — actually debit the cost and push out
 * the expiry week at the (currently forbidden) apply-site so the framing can go
 * past-tense.
 */
export function executeAutoRenew(
  rule: AutomationRule,
  state: GameState
): AutomationExecution | null {
  if (!isAutomationTypeUnlocked(state, 'renew')) {
    return null;
  }
  
  const money = state.stats.money || 0;
  const actionsTaken: AutomationExecution['actionsTaken'] = [];
  
  for (const action of rule.actions) {
    try {
      const result = executeRenewAction(action, state, money);
      if (result) {
        actionsTaken.push({
          type: action.type,
          value: result.amount,
          result: result.success ? 'success' : 'failed',
        });
      }
    } catch (error) {
      logger.error('Auto-renew action failed:', { action, error });
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
  const totalCost = actionsTaken.reduce((sum, a) => sum + a.value, 0);
  
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: 'renew',
    executedAt: Date.now(),
    success: successCount > 0,
    message: `Would renew ${successCount} items ($${totalCost.toLocaleString()})`,
    actionsTaken,
  };
}

/**
 * Execute a single renew action
 */
function executeRenewAction(
  action: AutomationAction,
  state: GameState,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  switch (action.type as AutoRenewActionType) {
    case 'renew_subscription':
      return executeRenewSubscription(action, availableCash);
    case 'renew_insurance':
      return executeRenewInsurance(action, availableCash);
    case 'renew_all':
      return executeRenewAll(state, availableCash);
    default:
      return { success: false, amount: 0, message: `Unknown action type: ${action.type}` };
  }
}

/**
 * Renew subscription
 */
function executeRenewSubscription(
  action: AutomationAction,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const subscriptionId = action.target;
  const cost = action.value || 50; // Default subscription cost
  
  if (availableCash < cost) {
    return { success: false, amount: 0, message: `Insufficient cash (need $${cost.toLocaleString()})` };
  }
  
  return {
    success: true,
    amount: cost,
    message: `Would renew subscription ${subscriptionId || 'default'} ($${cost.toLocaleString()})`,
  };
}

/**
 * Renew insurance
 */
function executeRenewInsurance(
  action: AutomationAction,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const insuranceType = action.target || 'health';
  const cost = action.value || 200; // Default insurance cost
  
  if (availableCash < cost) {
    return { success: false, amount: 0, message: `Insufficient cash (need $${cost.toLocaleString()})` };
  }
  
  return {
    success: true,
    amount: cost,
    message: `Would renew ${insuranceType} insurance ($${cost.toLocaleString()})`,
  };
}

/**
 * Renew all expiring items
 */
function executeRenewAll(
  state: GameState,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  let totalCost = 0;
  let renewedCount = 0;
  const weeksLived = state.weeksLived || 0;

  // Check for expiring vehicle insurance (within 4 weeks of expiry)
  const vehicles = state.vehicles || [];
  for (const v of vehicles) {
    if (v?.insurance?.active && v.insurance.expiresWeek) {
      const weeksUntilExpiry = v.insurance.expiresWeek - weeksLived;
      if (weeksUntilExpiry <= 4 && weeksUntilExpiry >= 0) {
        // Renew: 6 months upfront
        const renewCost = (v.insurance.monthlyCost || 0) * 6;
        totalCost += renewCost;
        renewedCount++;
      }
    }
  }

  if (totalCost === 0) {
    return { success: true, amount: 0, message: 'Nothing expiring soon' };
  }

  if (availableCash < totalCost) {
    return { success: false, amount: 0, message: `Insufficient cash to renew (need $${totalCost.toLocaleString()})` };
  }

  return {
    success: true,
    amount: totalCost,
    message: `Would renew ${renewedCount} expiring items ($${totalCost.toLocaleString()})`,
  };
}

/**
 * Create default auto-renew rule
 */
export function createDefaultAutoRenewRule(): AutomationRule {
  return {
    id: `auto_renew_${Date.now()}`,
    type: 'renew',
    name: 'Auto-Renew All',
    enabled: true,
    conditions: [
      {
        type: 'cash_above',
        value: 500,
      },
    ],
    actions: [
      {
        type: 'renew_all',
        value: 1,
      },
    ],
    priority: 70,
  };
}

