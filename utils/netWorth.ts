export interface Asset {
  id: string;
  type: string;
  baseValue: number;
  marketValue?: number;
  weeklyDepreciation?: number;
  weeksOwned?: number;
  depreciationFloor?: number; // as fraction of baseValue
  condition?: number; // 0-1
  illiquidity?: number; // 0-1
  trailingWeeklyProfit?: number; // for businesses
  valuationMultiple?: number; // for businesses
}

export interface Liability {
  id: string;
  type: string;
  principal: number;
  accruedInterest?: number;
  fees?: number;
}

export interface NetWorthBreakdown {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byAssetType: Record<string, number>;
  /**
   * The valued contribution of each input asset, in input order and UNROUNDED.
   *
   * Exists so a caller can itemise the total without re-deriving what an asset
   * is worth. `NetWorthBreakdownModal` used to keep a second, hand-maintained
   * list beside the one it passed in here, and the two drifted every single
   * time a term was added — the header rose, the visible rows did not, and the
   * percentages stopped reaching 100%. Reading the split back out of the same
   * pass makes that impossible.
   *
   * Unrounded on purpose: these are summed by the caller before display, and
   * rounding first would compound the error across a large portfolio.
   */
  perAsset: number[];
}

const DEFAULT_DEPRECIATION_FLOOR = 0.3;
const DEFAULT_TRANSACTION_FEE = 0.01;

export function depreciateValue(
  baseValue: number,
  weeklyDepreciation = 0,
  weeksOwned = 0,
  floorPercent = DEFAULT_DEPRECIATION_FLOOR
): number {
  const floor = baseValue * floorPercent;
  const depreciated = baseValue - weeklyDepreciation * weeksOwned;
  return Math.max(depreciated, floor);
}

export function valueBusiness(
  trailingWeeklyProfit = 0,
  valuationMultiple = 0
): number {
  return Math.max(0, trailingWeeklyProfit) * Math.max(0, valuationMultiple);
}

export function applyLiquidationAdjustments(
  value: number,
  condition = 1,
  illiquidity = 0,
  transactionFee = DEFAULT_TRANSACTION_FEE
): number {
  const conditioned = value * Math.max(0, Math.min(1, condition));
  const illiquidAdjusted = conditioned * (1 - Math.max(0, Math.min(1, illiquidity)));
  return illiquidAdjusted * (1 - Math.max(0, Math.min(1, transactionFee)));
}

export interface ComputeNetWorthOptions {
  /**
   * Liquidation fee applied to every asset as a fraction in `[0, 1]` — the
   * fire-sale haircut you would eat selling the whole portfolio today.
   * Defaults to {@link DEFAULT_TRANSACTION_FEE} (1%). Pass `0` to agree with
   * the canonical `netWorth()` (`lib/progress/achievements.ts`), which applies
   * no such fee. A non-finite value falls back to the default.
   */
  transactionFee?: number;
}

/**
 * Value a portfolio of {@link Asset}s and {@link Liability}s into a
 * {@link NetWorthBreakdown}, applying depreciation, business valuation and a
 * liquidation haircut to each asset before summing.
 *
 * @param assets - the holdings to value, in display order.
 * @param liabilities - debts subtracted from the asset total.
 * @param options - see {@link ComputeNetWorthOptions}; `transactionFee`
 *   controls the per-asset liquidation haircut.
 * @returns rounded totals plus `perAsset`, the unrounded contribution of each
 *   input asset in order, so a caller can itemise without re-valuing.
 */
export function computeNetWorth(
  assets: Asset[],
  liabilities: Liability[],
  options: ComputeNetWorthOptions = {}
): NetWorthBreakdown {
  // Callers that must agree with the canonical `netWorth()` (which applies no
  // liquidation fee) pass `transactionFee: 0`. The default preserves the
  // fire-sale haircut for any caller genuinely pricing a liquidation. Validate
  // and clamp: a non-finite override would make `applyLiquidationAdjustments`
  // return NaN and poison every total, so reject it back to the default and
  // clamp a finite value into [0, 1].
  const configuredFee = options.transactionFee;
  const transactionFee =
    typeof configuredFee === 'number' && isFinite(configuredFee)
      ? Math.max(0, Math.min(1, configuredFee))
      : DEFAULT_TRANSACTION_FEE;
  let totalAssets = 0;
  const byAssetType: Record<string, number> = {};
  const perAsset: number[] = [];

  for (const asset of assets) {
    let value = 0;

    if (
      asset.trailingWeeklyProfit !== undefined &&
      asset.valuationMultiple !== undefined
    ) {
      value = valueBusiness(
        asset.trailingWeeklyProfit,
        asset.valuationMultiple
      );
    } else {
      const base = asset.marketValue ?? asset.baseValue;
      value = depreciateValue(
        base,
        asset.weeklyDepreciation,
        asset.weeksOwned,
        asset.depreciationFloor
      );
    }

    value = applyLiquidationAdjustments(
      value,
      asset.condition,
      asset.illiquidity,
      transactionFee
    );

    value = Math.max(0, value);
    totalAssets += value;
    perAsset.push(value);
    byAssetType[asset.type] = (byAssetType[asset.type] || 0) + value;
  }

  let totalLiabilities = 0;
  for (const liability of liabilities) {
    const value = Math.max(
      0,
      (liability.principal || 0) +
        (liability.accruedInterest || 0) +
        (liability.fees || 0)
    );
    totalLiabilities += value;
  }

  const netWorth = totalAssets - totalLiabilities;

  const roundedBreakdown: Record<string, number> = {};
  for (const [type, val] of Object.entries(byAssetType)) {
    roundedBreakdown[type] = Math.round(val);
  }

  return {
    totalAssets: Math.round(totalAssets),
    totalLiabilities: Math.round(totalLiabilities),
    netWorth: Math.round(netWorth),
    byAssetType: roundedBreakdown,
    perAsset,
  };
}
