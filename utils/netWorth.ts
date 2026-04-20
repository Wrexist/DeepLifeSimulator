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

export function computeNetWorth(
  assets: Asset[],
  liabilities: Liability[]
): NetWorthBreakdown {
  let totalAssets = 0;
  const byAssetType: Record<string, number> = {};

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
      asset.illiquidity
    );

    value = Math.max(0, value);
    totalAssets += value;
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
  };
}
