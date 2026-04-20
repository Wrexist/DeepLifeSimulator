import type { GameState } from '@/contexts/game/types';
import type { AutomationRule, AutomationExecution, AutomationAction } from './automationTypes';
import { isAutomationTypeUnlocked } from './automationEngine';
import { logger } from '@/utils/logger';

/**
 * Auto-pay action types
 */
export type AutoPayActionType = 
  | 'pay_loan_minimum' // Pay minimum payment
  | 'pay_loan_full' // Pay full balance
  | 'pay_bills' // Pay all bills
  | 'pay_specific_loan'; // Pay specific loan

/**
 * Execute auto-pay rule
 */
export function executeAutoPay(
  rule: AutomationRule,
  state: GameState
): AutomationExecution | null {
  if (!isAutomationTypeUnlocked(state, 'pay')) {
    return null;
  }
  
  const money = state.stats.money || 0;
  const loans = state.loans || [];
  const actionsTaken: AutomationExecution['actionsTaken'] = [];
  
  for (const action of rule.actions) {
    try {
      const result = executePayAction(action, state, money, loans);
      if (result) {
        actionsTaken.push({
          type: action.type,
          value: result.amount,
          result: result.success ? 'success' : 'failed',
        });
      }
    } catch (error) {
      logger.error('Auto-pay action failed:', { action, error });
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
  const totalPaid = actionsTaken.reduce((sum, a) => sum + a.value, 0);
  
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: 'pay',
    executedAt: Date.now(),
    success: successCount > 0,
    message: `Paid $${totalPaid.toLocaleString()} (${successCount} payments)`,
    actionsTaken,
  };
}

/**
 * Execute a single pay action
 */
function executePayAction(
  action: AutomationAction,
  state: GameState,
  availableCash: number,
  loans: GameState['loans']
): { success: boolean; amount: number; message: string } | null {
  switch (action.type as AutoPayActionType) {
    case 'pay_loan_minimum':
      return executePayLoanMinimum(loans, availableCash);
    case 'pay_loan_full':
      return executePayLoanFull(loans, availableCash);
    case 'pay_bills':
      return executePayBills(state, availableCash);
    case 'pay_specific_loan':
      return executePaySpecificLoan(action, loans, availableCash);
    default:
      return { success: false, amount: 0, message: `Unknown action type: ${action.type}` };
  }
}

/**
 * Pay minimum payments on all loans
 */
function executePayLoanMinimum(
  loans: GameState['loans'],
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  if (loans.length === 0) {
    return { success: true, amount: 0, message: 'No loans to pay' };
  }

  const totalMinimum = loans.reduce((sum, loan) => {
    return sum + (loan.weeklyPayment || 0);
  }, 0);

  if (availableCash < totalMinimum) {
    return { success: false, amount: 0, message: `Insufficient cash (need $${totalMinimum.toLocaleString()})` };
  }

  return {
    success: true,
    amount: totalMinimum,
    message: `Paid $${totalMinimum.toLocaleString()} in minimum payments (${loans.length} loans)`,
  };
}

/**
 * Pay full balance on all loans
 */
function executePayLoanFull(
  loans: GameState['loans'],
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  if (loans.length === 0) {
    return { success: true, amount: 0, message: 'No loans to pay' };
  }

  const totalBalance = loans.reduce((sum, loan) => {
    return sum + (loan.remaining || 0);
  }, 0);

  if (availableCash < totalBalance) {
    return { success: false, amount: 0, message: `Insufficient cash (need $${totalBalance.toLocaleString()})` };
  }

  return {
    success: true,
    amount: totalBalance,
    message: `Paid $${totalBalance.toLocaleString()} in full (${loans.length} loans)`,
  };
}

/**
 * Pay all bills
 */
function executePayBills(
  state: GameState,
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  // Calculate real weekly expenses from game state
  let totalBills = 0;

  // Rent/housing costs
  const housing = state.housing;
  if (housing?.monthlyPayment) {
    totalBills += Math.ceil(housing.monthlyPayment / 4); // Weekly rent
  }

  // Vehicle maintenance and fuel
  const vehicles = state.vehicles || [];
  for (const v of vehicles) {
    if (v?.owned) {
      totalBills += (v.weeklyMaintenanceCost || 0) + (v.weeklyFuelCost || 0);
    }
  }

  // Loan minimum payments
  const loans = state.loans || [];
  for (const loan of loans) {
    if (loan.autoPay) {
      totalBills += loan.weeklyPayment || 0;
    }
  }

  if (totalBills === 0) {
    return { success: true, amount: 0, message: 'No bills to pay' };
  }

  if (availableCash < totalBills) {
    return { success: false, amount: 0, message: `Insufficient cash for bills (need $${totalBills.toLocaleString()})` };
  }

  return {
    success: true,
    amount: totalBills,
    message: `Paid $${totalBills.toLocaleString()} in weekly bills`,
  };
}

/**
 * Pay specific loan
 */
function executePaySpecificLoan(
  action: AutomationAction,
  loans: GameState['loans'],
  availableCash: number
): { success: boolean; amount: number; message: string } | null {
  const loanId = action.target;
  if (!loanId) {
    return { success: false, amount: 0, message: 'No loan ID specified' };
  }
  
  const loan = loans.find(l => l.id === loanId);
  if (!loan) {
    return { success: false, amount: 0, message: `Loan ${loanId} not found` };
  }
  
  const payFull = action.value === 1; // 1 = full, 0 = minimum
  const amount = payFull ? (loan.remaining || 0) : (loan.weeklyPayment || 0);
  
  if (availableCash < amount) {
    return { success: false, amount: 0, message: `Insufficient cash (need $${amount.toLocaleString()})` };
  }
  
  return {
    success: true,
    amount,
    message: `Paid $${amount.toLocaleString()} on loan ${loanId}`,
  };
}

/**
 * Create default auto-pay rule
 */
export function createDefaultAutoPayRule(): AutomationRule {
  return {
    id: `auto_pay_${Date.now()}`,
    type: 'pay',
    name: 'Auto-Pay Minimums',
    enabled: true,
    conditions: [
      {
        type: 'cash_above',
        value: 1000,
      },
    ],
    actions: [
      {
        type: 'pay_loan_minimum',
        value: 1,
      },
    ],
    priority: 60,
  };
}

