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
 * A concrete stock-buy order planned by an 'invest' rule this run.
 *
 * The auto-invest executors are PURE planners (no setGameState), so they can't
 * buy directly. They emit these orders on the execution result; the week-tick
 * apply-site (GameActionsContext) then routes each one through the canonical
 * `buyStockMarket` action, which owns the cash debit, broker fee, affordability
 * check, and holdings update. Keeping the debit inside `buyStockMarket` means
 * only `stats.money` is ever touched (never a mirrored banking account) and no
 * order can overspend.
 */
export interface InvestOrder {
  symbol: string;
  /** USD notional to spend (broker fee is added on top by buyStockMarket). */
  amountUSD: number;
  /** Mid price used for the fill — same source the manual buy path uses. */
  midPrice: number;
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
  /**
   * Buy orders an 'invest' rule planned this run. Transient wiring the apply-site
   * consumes to execute the real purchases; it is stripped before the execution
   * is persisted to `executionHistory`.
   */
  investOrders?: InvestOrder[];
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

