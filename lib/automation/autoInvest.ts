import type { GameState } from '@/contexts/game/types';
import type { AutomationRule, AutomationExecution, AutomationAction, InvestOrder } from './automationTypes';
import { isAutomationTypeUnlocked } from './automationGuards';
import { getStockInfo } from '@/lib/economy/stockMarket';
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
 * Broker commission — MIRROR of `STOCK_FEE` in
 * contexts/game/actions/StockActions.ts. The apply-site runs every planned order
 * through `buyStockMarket`, which is the AUTHORITATIVE affordability gate (it
 * rejects any order whose notional+fee exceeds live cash). This local copy only
 * lets the planner reserve the fee up front so it never *proposes* an order the
 * buy path would reject — keeping the reported message honest. If the two ever
 * drift, the worst case is a rejected order, never an overspend.
 */
const STOCK_FEE = 0.02;

/**
 * Fallback symbol when an invest rule doesn't name one. Must be a real, tradeable
 * ticker in `lib/economy/stockMarket` — the legacy default 'SPY' is NOT in that
 * universe (it would price at 0 and never fill), so unconfigured rules used to be
 * dead on arrival.
 */
const DEFAULT_INVEST_SYMBOL = 'AAPL';

type Holdings = NonNullable<GameState['stocks']>['holdings'];

/** Result of planning a single invest action. */
interface InvestActionResult {
  result: 'success' | 'failed' | 'skipped';
  /** USD notional actually planned (0 for failed / skipped). */
  amount: number;
  message: string;
  orders: InvestOrder[];
}

const safeNum = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Floor a dollar figure to whole cents (keeps notional*fee safely under cash). */
const toCents = (n: number): number => (n > 0 ? Math.floor(n * 100) / 100 : 0);

const fmt = (n: number): string => Math.round(n).toLocaleString();

/**
 * Largest notional the planner may spend given `cash`, reserving the broker fee
 * so `notional + fee <= cash`. Floored to cents so float error can never push
 * the real (buyStockMarket) affordability check over the edge.
 */
const maxAffordableNotional = (cash: number): number =>
  cash > 0 ? toCents(cash / (1 + STOCK_FEE)) : 0;

/**
 * Current mid price for a symbol from the SAME source the manual buy path uses
 * (StocksApp → getStockInfo). Returns 0 for any symbol not in the tradeable
 * universe (e.g. 'SPY') so callers can honestly refuse instead of faking a fill.
 */
function marketPrice(symbol: string): number {
  try {
    const info = getStockInfo(symbol);
    return info && typeof info.price === 'number' && isFinite(info.price) && info.price > 0 ? info.price : 0;
  } catch {
    return 0;
  }
}

const fail = (message: string): InvestActionResult => ({ result: 'failed', amount: 0, message, orders: [] });
const skip = (message: string): InvestActionResult => ({ result: 'skipped', amount: 0, message, orders: [] });
const buyOne = (symbol: string, amountUSD: number, midPrice: number, message: string): InvestActionResult => ({
  result: 'success',
  amount: amountUSD,
  message,
  orders: [{ symbol, amountUSD, midPrice }],
});

/**
 * Execute auto-invest rule.
 *
 * The executors are PURE planners: they validate the symbol, compute a
 * fee-inclusive-affordable notional against a running cash budget, and emit
 * concrete `InvestOrder`s. They never move money themselves — the apply-site
 * runs each order through the canonical `buyStockMarket` action (the single
 * owner of the cash debit), so cash comes out of `stats.money` exactly once and
 * mirrored banking accounts are never touched.
 */
export function executeAutoInvest(
  rule: AutomationRule,
  state: GameState
): AutomationExecution | null {
  if (!isAutomationTypeUnlocked(state, 'invest')) {
    return null;
  }

  const holdings: Holdings = state.stocks?.holdings || [];
  const actionsTaken: AutomationExecution['actionsTaken'] = [];
  const investOrders: InvestOrder[] = [];
  // Running budget: starts at real cash and shrinks as we reserve each order's
  // notional+fee, so multiple actions in one rule can't collectively overspend.
  let remainingCash = Math.max(0, safeNum(state.stats?.money));

  for (const action of rule.actions) {
    try {
      const result = executeInvestAction(action, state, remainingCash, holdings);
      if (result) {
        actionsTaken.push({
          type: action.type,
          value: result.amount,
          result: result.result,
        });
        for (const order of result.orders) {
          investOrders.push(order);
          remainingCash = Math.max(0, remainingCash - order.amountUSD * (1 + STOCK_FEE));
        }
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
  const totalInvested = investOrders.reduce((sum, o) => sum + o.amountUSD, 0);

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: 'invest',
    executedAt: Date.now(),
    success: successCount > 0,
    message: investOrders.length > 0
      ? `Invested $${fmt(totalInvested)} across ${investOrders.length} order${investOrders.length === 1 ? '' : 's'}`
      : 'No investments executed',
    actionsTaken,
    investOrders,
  };
}

/**
 * Execute a single investment action
 */
function executeInvestAction(
  action: AutomationAction,
  state: GameState,
  availableCash: number,
  holdings: Holdings
): InvestActionResult | null {
  switch (action.type as AutoInvestActionType) {
    case 'dca':
      return executeDCA(action, availableCash);
    case 'percentage':
      return executePercentageInvest(action, availableCash);
    case 'target_allocation':
      return executeTargetAllocation(action, availableCash, holdings);
    case 'price_trigger':
      return executePriceTrigger(action, state, availableCash);
    case 'rebalance':
      return executeRebalance(availableCash, holdings);
    default:
      return fail(`Unknown action type: ${action.type}`);
  }
}

/**
 * Dollar-cost averaging: Invest a fixed amount in the configured symbol per run.
 */
function executeDCA(
  action: AutomationAction,
  availableCash: number
): InvestActionResult {
  const targetSymbol = (action.target || DEFAULT_INVEST_SYMBOL).toUpperCase();
  const price = marketPrice(targetSymbol);
  if (price <= 0) {
    return fail(`DCA: ${targetSymbol} is not a tradeable symbol`);
  }
  const desired = safeNum(action.value);
  if (desired <= 0) {
    return fail('DCA: invalid amount configured');
  }
  // Buy the configured amount, but never more than cash (net of fee) allows.
  const amount = toCents(Math.min(desired, maxAffordableNotional(availableCash)));
  if (amount <= 0) {
    return fail('Insufficient cash for DCA');
  }
  return buyOne(targetSymbol, amount, price, `DCA: Invested $${fmt(amount)} in ${targetSymbol}`);
}

/**
 * Percentage-based: Invest X% of available cash in the configured symbol.
 */
function executePercentageInvest(
  action: AutomationAction,
  availableCash: number
): InvestActionResult {
  const percentage = Math.min(Math.max(safeNum(action.value), 0), 100);
  const targetSymbol = (action.target || DEFAULT_INVEST_SYMBOL).toUpperCase();
  const price = marketPrice(targetSymbol);
  if (price <= 0) {
    return fail(`Percentage: ${targetSymbol} is not a tradeable symbol`);
  }
  const desired = availableCash * (percentage / 100);
  const amount = toCents(Math.min(desired, maxAffordableNotional(availableCash)));
  if (amount <= 0) {
    return fail('Insufficient cash for percentage investment');
  }
  return buyOne(targetSymbol, amount, price, `Percentage: Invested $${fmt(amount)} (${percentage}%) in ${targetSymbol}`);
}

/**
 * Target allocation: Buy the configured symbol toward an X% stocks weighting.
 */
function executeTargetAllocation(
  action: AutomationAction,
  availableCash: number,
  holdings: Holdings
): InvestActionResult {
  const targetPercentage = Math.min(Math.max(safeNum(action.value), 0), 100);

  // Current portfolio value (mark-to-market on holdings).
  const stockValue = holdings.reduce((sum, h) => sum + safeNum(h.shares) * safeNum(h.currentPrice), 0);
  const totalAssets = availableCash + stockValue;
  const currentPercentage = totalAssets > 0 ? (stockValue / totalAssets) * 100 : 0;

  if (currentPercentage >= targetPercentage) {
    return skip(`Target allocation already met (${currentPercentage.toFixed(1)}%)`);
  }

  // Need a concrete symbol to buy toward the target — there is no index/ETF to
  // buy "the market", so an unconfigured target can't be honored.
  const symbol = (action.target || '').toUpperCase();
  if (!symbol) {
    return fail('Target allocation: no target symbol configured');
  }
  const price = marketPrice(symbol);
  if (price <= 0) {
    return fail(`Target allocation: ${symbol} is not a tradeable symbol`);
  }

  const targetStockValue = (totalAssets * targetPercentage) / 100;
  const needed = Math.max(0, targetStockValue - stockValue);
  const amount = toCents(Math.min(needed, maxAffordableNotional(availableCash)));
  if (amount <= 0) {
    return fail('Insufficient cash to reach target allocation');
  }
  return buyOne(symbol, amount, price, `Target allocation: Invested $${fmt(amount)} in ${symbol} toward ${targetPercentage}%`);
}

/**
 * Price trigger: Buy the symbol when it has dropped >= X% from last week's price.
 */
function executePriceTrigger(
  action: AutomationAction,
  state: GameState,
  availableCash: number
): InvestActionResult {
  const targetSymbol = action.target?.toUpperCase();
  if (!targetSymbol) {
    return fail('No target symbol specified for price trigger');
  }
  const price = marketPrice(targetSymbol);
  if (price <= 0) {
    return fail(`Price trigger: ${targetSymbol} is not a tradeable symbol`);
  }

  // Prior-week price is the same snapshot the manual UI reads for its ▲/▼ change.
  const prev = state.stocks?.lastWeekPrices?.[targetSymbol]?.price;
  if (typeof prev !== 'number' || !isFinite(prev) || prev <= 0) {
    return skip(`Price trigger: no prior price for ${targetSymbol} yet`);
  }

  const dropThreshold = safeNum(action.value); // e.g. 5 => buy on a 5%+ drop
  const dropPct = ((prev - price) / prev) * 100;
  if (dropPct < dropThreshold) {
    return skip(`Price trigger: ${targetSymbol} ${dropPct >= 0 ? 'down' : 'up'} ${Math.abs(dropPct).toFixed(1)}% (need ≥ ${dropThreshold}% drop)`);
  }

  // On trigger, deploy 10% of available cash (legacy behavior), fee-capped.
  const amount = toCents(Math.min(availableCash * 0.1, maxAffordableNotional(availableCash)));
  if (amount <= 0) {
    return fail('Insufficient cash for price trigger');
  }
  return buyOne(targetSymbol, amount, price, `Price trigger: ${targetSymbol} dropped ${dropPct.toFixed(1)}% — invested $${fmt(amount)}`);
}

/**
 * Rebalance: minimal SAFE version — buy-only. Lift underweight positions toward
 * the equal-weight target using available cash. No selling (a full sell+rebuy
 * rebalance is broader and riskier; this moves toward balance without ever
 * liquidating a position or realizing gains).
 */
function executeRebalance(
  availableCash: number,
  holdings: Holdings
): InvestActionResult {
  if (!holdings || holdings.length === 0) {
    return fail('No holdings to rebalance');
  }

  const positions = holdings
    .map(h => ({
      symbol: h.symbol.toUpperCase(),
      value: safeNum(h.shares) * safeNum(h.currentPrice),
      // Prefer the live market price (matches the buy path); fall back to the
      // holding's last known price so a valid position is never skipped.
      price: marketPrice(h.symbol) || safeNum(h.currentPrice),
    }))
    .filter(p => p.price > 0);

  if (positions.length === 0) {
    return fail('No priceable holdings to rebalance');
  }

  const stockTotal = positions.reduce((sum, p) => sum + p.value, 0);
  if (stockTotal <= 0) {
    return fail('No holdings value to rebalance');
  }

  const targetPerPosition = stockTotal / positions.length;
  const underweight = positions
    .filter(p => p.value < targetPerPosition)
    .sort((a, b) => (targetPerPosition - b.value) - (targetPerPosition - a.value)); // biggest shortfall first

  const orders: InvestOrder[] = [];
  let totalAmount = 0;
  let remaining = availableCash;

  for (const p of underweight) {
    const cap = maxAffordableNotional(remaining);
    if (cap <= 0) break;
    const shortfall = targetPerPosition - p.value;
    const amount = toCents(Math.min(shortfall, cap));
    if (amount <= 0.01) continue; // ignore sub-cent dust
    orders.push({ symbol: p.symbol, amountUSD: amount, midPrice: p.price });
    totalAmount += amount;
    remaining = Math.max(0, remaining - amount * (1 + STOCK_FEE));
  }

  if (orders.length === 0) {
    return skip('Rebalance: already balanced or insufficient cash');
  }

  return {
    result: 'success',
    amount: totalAmount,
    orders,
    message: `Rebalance: bought ${orders.length} underweight position${orders.length === 1 ? '' : 's'} toward equal weight (buy-only)`,
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
        target: DEFAULT_INVEST_SYMBOL,
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
        target: DEFAULT_INVEST_SYMBOL,
      },
    ],
    priority: 40,
  };
}
