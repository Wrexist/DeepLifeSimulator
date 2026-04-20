/**
 * Automation rule types
 */
export type AutomationRuleType = 'invest' | 'save' | 'pay' | 'renew';

/**
 * Automation condition types
 */
export type AutomationConditionType = 
  | 'cash_above'
  | 'cash_below'
  | 'cash_percentage'
  | 'income_received'
  | 'week_number'
  | 'always';

/**
 * Automation condition
 */
export interface AutomationCondition {
  type: AutomationConditionType;
  value: number; // Threshold value
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'; // Comparison operator
}

/**
 * Automation action
 */
export interface AutomationAction {
  type: string; // Action-specific type
  value: number; // Action value (amount, percentage, etc.)
  target?: string; // Target (stock symbol, loan ID, etc.)
}

/**
 * Automation rule
 */
export interface AutomationRule {
  id: string;
  type: AutomationRuleType;
  name: string;
  enabled: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number; // Higher priority executes first
  lastExecuted?: number; // Timestamp of last execution
  executionCount?: number; // Number of times executed
}

/**
 * Automation execution result
 */
export interface AutomationExecution {
  ruleId: string;
  ruleName: string;
  type: AutomationRuleType;
  executedAt: number;
  success: boolean;
  message: string;
  actionsTaken: {
    type: string;
    value: number;
    result: 'success' | 'failed' | 'skipped';
  }[];
}

/**
 * Automation state
 */
export interface AutomationState {
  rules: AutomationRule[];
  executionHistory: AutomationExecution[];
  maxSlots: number; // Maximum concurrent rules (1 base + purchased slots)
  enabled: boolean; // Global automation toggle
}

