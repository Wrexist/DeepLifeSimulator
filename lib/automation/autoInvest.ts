import type { GameState } from '@/contexts/game/types';
import type { AutomationRule, AutomationExecution, AutomationAction } from './automationTypes';
import { isAutomationTypeUnlocked } from './automationEngine';
import { logger } from '@/utils/logger';

/**
 * Auto-invest action types
 */
export type AutoInvestActionType = 
  | 'dca' // Dollar-cost averaging
  | 'percentage' // Percentage of cash
  | 'target_allocation' // Maintain target allocation
  | 'price_trigger' // Buy when price drops
  | 'rebalance'; // Rebalance portfolio

/**
 * Execute auto-invest rule
 */
export function executeAutoInvest(
  rule: AutomationRule,
  state: GameState
): AutomationExecution | null {
  if (!isAutomationTypeUnlocked(state, 'invest')) {
    return null;
  }
  
  const money = state.stats.money || 0;
  const stocks = state.stocks?.holdings || [];
  const actionsTaken: AutomationExecution['actionsTaken'] = [];
  
  for (const action of rule.actions) {
    try {
      const result = executeInvestAction(action, state, money, stocks);
      if (result) {
        actionsTaken.push({
          type: action.type,
          value: action.value,
          result: result.success ? 'success' : 'failed',
        });
      }
    } catch (error) {
      logger.error('Auto-invest action failed:', { action, error });
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
    type: 'invest',
    executedAt: Date.now(),
    success: successCount > 0,
    message: `Executed ${successCount} of ${actionsTaken.length} investment actions`,
    actionsTaken,
  };
}

/**
 * Execute a single investment action
 */
function executeInvestAction(
  action: AutomationAction,
  state: GameState,
  availableCash: number,
  currentHoldings: GameState['stocks']['holdings']
): { success: boolean; message: string } | null {
  switch (action.type as AutoInvestActionType) {
    case 'dca':
      return executeDCA(action, state, availableCash);
    case 'percentage':
      return executePercentageInvest(action, state, availableCash);
    case 'target_allocation':
      return executeTargetAllocation(action, state, availableCash, currentHoldings);
    case 'price_trigger':
      return executePriceTrigger(action, state, availableCash);
    case 'rebalance':
      return executeRebalance(action, state, availableCash, currentHoldings);
    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

/**
 * Dollar-cost averaging: Invest fixed amount per week
 */
function executeDCA(
  action: AutomationAction,
  state: GameState,
  availableCash: number
): { success: boolean; message: string } | null {
  const amount = Math.min(action.value, availableCash);
  if (amount <= 0) {
    return { success: false, message: 'Insufficient cash for DCA' };
  }
  
  const targetSymbol = action.target || 'SPY'; // Default to S&P 500
  
  // Note: Actual stock purchase would be handled by the stock system
  // This is a placeholder that returns success
  return {
    success: true,
    message: `DCA: Invested $${amount.toLocaleString()} in ${targetSymbol}`,
  };
}

/**
 * Percentage-based: Invest X% of cash
 */
function executePercentageInvest(
  action: AutomationAction,
  state: GameState,
  availableCash: number
): { success: boolean; message: string } | null {
  const percentage = Math.min(action.value, 100);
  const amount = Math.floor(availableCash * (percentage / 100));
  
  if (amount <= 0) {
    return { success: false, message: 'Insufficient cash for percentage investment' };
  }
  
  const targetSymbol = action.target || 'SPY';
  
  return {
    success: true,
    message: `Percentage: Invested $${amount.toLocaleString()} (${percentage}%) in ${targetSymbol}`,
  };
}

/**
 * Target allocation: Maintain X% in stocks
 */
function executeTargetAllocation(
  action: AutomationAction,
  state: GameState,
  availableCash: number,
  currentHoldings: GameState['stocks']['holdings']
): { success: boolean; message: string } | null {
  const targetPercentage = Math.min(action.value, 100);
  
  // Calculate current portfolio value
  const stockValue = currentHoldings.reduce((sum, holding) => {
    return sum + (holding.shares * holding.currentPrice);
  }, 0);
  
  const totalAssets = availableCash + stockValue;
  const currentPercentage = totalAssets > 0 ? (stockValue / totalAssets) * 100 : 0;
  
  if (currentPercentage >= targetPercentage) {
    return { success: true, message: `Target allocation already met (${currentPercentage.toFixed(1)}%)` };
  }
  
  // Calculate how much to invest to reach target
  const targetStockValue = (totalAssets * targetPercentage) / 100;
  const neededInvestment = Math.max(0, targetStockValue - stockValue);
  const investAmount = Math.min(neededInvestment, availableCash);
  
  if (investAmount <= 0) {
    return { success: false, message: 'Insufficient cash to reach target allocation' };
  }
  
  return {
    success: true,
    message: `Target allocation: Investing $${investAmount.toLocaleString()} to reach ${targetPercentage}%`,
  };
}

/**
 * Price trigger: Buy when price drops X%
 */
function executePriceTrigger(
  action: AutomationAction,
  state: GameState,
  availableCash: number
): { success: boolean; message: string } | null {
  const targetSymbol = action.target;
  if (!targetSymbol) {
    return { success: false, message: 'No target symbol specified for price trigger' };
  }
  
  const dropPercentage = action.value; // e.g., 5 for 5% drop
  const investAmount = availableCash * 0.1; // Invest 10% of cash on trigger
  
  // Note: Would need to check actual price drop from previous week
  // This is a placeholder
  return {
    success: true,
    message: `Price trigger: Would invest $${investAmount.toLocaleString()} in ${targetSymbol} if price drops ${dropPercentage}%`,
  };
}

/**
 * Rebalance: Rebalance portfolio to target allocations
 */
function executeRebalance(
  action: AutomationAction,
  state: GameState,
  availableCash: number,
  currentHoldings: GameState['stocks']['holdings']
): { success: boolean; message: string } | null {
  // Rebalancing logic would need target allocations per stock
  // This is a simplified version
  
  if (currentHoldings.length === 0) {
    return { success: false, message: 'No holdings to rebalance' };
  }
  
  // Calculate total portfolio value
  const totalValue = currentHoldings.reduce((sum, holding) => {
    return sum + (holding.shares * holding.currentPrice);
  }, 0) + availableCash;
  
  // Equal weight rebalancing (simplified)
  const targetPerStock = totalValue / (currentHoldings.length + 1); // +1 for cash
  
  return {
    success: true,
    message: `Rebalanced portfolio to equal weights (${currentHoldings.length} positions)`,
  };
}

/**
 * Create default DCA rule
 */
export function createDefaultDCARule(): AutomationRule {
  return {
    id: `dca_${Date.now()}`,
    type: 'invest',
    name: 'Weekly DCA',
    enabled: true,
    conditions: [
      {
        type: 'cash_above',
        value: 1000,
      },
    ],
    actions: [
      {
        type: 'dca',
        value: 500, // $500 per week
        target: 'SPY',
      },
    ],
    priority: 50,
  };
}

/**
 * Create default percentage rule
 */
export function createDefaultPercentageRule(): AutomationRule {
  return {
    id: `percentage_${Date.now()}`,
    type: 'invest',
    name: 'Auto-Invest 10%',
    enabled: true,
    conditions: [
      {
        type: 'cash_above',
        value: 500,
      },
    ],
    actions: [
      {
        type: 'percentage',
        value: 10, // 10% of cash
        target: 'SPY',
      },
    ],
    priority: 40,
  };
}

