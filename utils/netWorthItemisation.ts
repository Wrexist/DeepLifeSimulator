/**
 * The itemised net-worth breakdown — one list, valued once.
 *
 * `NetWorthBreakdownModal` used to keep TWO lists: the assets it fed to
 * `computeNetWorth` for the headline, and a hand-written list of display rows
 * beneath it. They drifted every single time a term was added. Stocks and
 * luxury reached the total but never got a row; later bank accounts and crypto
 * did the same. Each time, the visible symptom was the same and easy to miss —
 * the big number stayed right while the percentages under it stopped reaching
 * 100%, so the modal quietly under-explained the figure it existed to explain.
 *
 * The two lists are now one. Every asset carries the display group it belongs
 * to, `computeNetWorth` reports what each asset was worth (`perAsset`), and the
 * rows are folded up from that. A term cannot enter the total without entering
 * the list, because there is only one list.
 *
 * Deliberately free of React and of `lucide-react-native`: group keys are
 * strings, and the modal maps them to icons and colours. That is what lets the
 * sum invariant be asserted in a plain node test instead of a render harness
 * (which cannot seed a portfolio to assert on).
 */
import type { GameState } from '@/contexts/game/types';
import { Asset, Liability, NetWorthBreakdown, computeNetWorth } from '@/utils/netWorth';
import { MIRRORED_ACCOUNT_IDS, totalCreditCardDebt } from '@/lib/banking/operations';
import { getOwnedLuxuryItems, getLuxuryHoldingValue } from '@/lib/luxury';
import { MINER_PRICES } from '@/lib/economy/constants';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/** Display groups, in the order the modal renders them. */
export const NET_WORTH_GROUPS = [
  'cash',
  'savings',
  'accounts',
  'crypto',
  'stocks',
  'luxury',
  'property',
  'vehicle',
  'business',
  'hardware',
  'item',
] as const;

export type NetWorthGroup = (typeof NET_WORTH_GROUPS)[number];

export interface NetWorthGroupRow {
  group: NetWorthGroup;
  /** Rounded group total — what the row prints. */
  value: number;
  /** One entry per asset in the group, in the order they were valued. */
  items: { name: string; value: number }[];
}

export interface NetWorthItemisation {
  breakdown: NetWorthBreakdown;
  rows: NetWorthGroupRow[];
}

/** An asset plus the display metadata `computeNetWorth` ignores. */
type TaggedAsset = Asset & { group: NetWorthGroup; rowName: string };

export function buildNetWorthItemisation(gameState: GameState): NetWorthItemisation {
  const { stats, bankSavings = 0, items, companies, realEstate, vehicles } = gameState;
  const assets: TaggedAsset[] = [];

  if ((stats?.money ?? 0) > 0) {
    assets.push({ id: 'cash', type: 'cash', baseValue: stats.money, group: 'cash', rowName: 'Wallet' });
  }

  if ((bankSavings || 0) > 0) {
    assets.push({
      id: 'savings',
      type: 'cash',
      baseValue: bankSavings || 0,
      group: 'savings',
      rowName: 'Savings Account',
    });
  }

  // Savings goals are money the player still owns, so the canonical `netWorth()`
  // adds each goal's `currentAmount` on top of cash and savings. The modal used
  // to omit them, so tapping the headline showed a total BELOW the card that
  // opened it. Same strict guard as canonical (`typeof === 'number'`, > 0), and
  // each goal gets its own named row under the same Savings group.
  (gameState.banking?.savingsGoals ?? []).forEach((goal, i) => {
    const amount = goal?.currentAmount;
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) return;
    assets.push({
      id: `savings_goal_${goal?.id ?? i}`,
      type: 'cash',
      baseValue: amount,
      group: 'savings',
      rowName: goal?.name ? `Goal: ${goal.name}` : 'Savings Goal',
    });
  });

  // Accounts the player opened themselves. `MIRRORED_ACCOUNT_IDS` are skipped
  // because those two rows ARE the cash and savings above - 1:1 mirrors of
  // `stats.money` and `bankSavings` - so counting them here would double them.
  (gameState.banking?.accounts ?? []).forEach((a, i) => {
    if (!a) return;
    // Resolved ONCE. The id was previously read three ways in four lines - bare
    // for the mirror check, `?? i` for the asset id, and as a name fallback -
    // so an account missing an id both escaped the mirror check and rendered a
    // row literally named "undefined".
    const accountId = a.id ?? `account-${i}`;
    if (MIRRORED_ACCOUNT_IDS.has(accountId)) return;
    if ((a.balance || 0) <= 0) return;
    assets.push({
      id: `account_${accountId}`,
      type: 'cash',
      baseValue: a.balance || 0,
      group: 'accounts',
      rowName: a.name || accountId,
    });
  });

  (gameState.cryptos || []).forEach((c, i) => {
    const value = (c?.owned || 0) * (c?.price || 0);
    if (value <= 0) return;
    assets.push({
      id: `crypto_${c?.id ?? i}`,
      type: 'investment',
      baseValue: value,
      group: 'crypto',
      rowName: c?.name || c?.symbol || c?.id || `Coin ${i + 1}`,
    });
  });

  /**
   * Laundered dark-web BTC, valued exactly as the canonical `netWorth()` values
   * it (D-5) - `cleanBtc × the BTC price`, dirty BTC excluded.
   *
   * It gets its own row rather than being folded into the coin above it: it is
   * the same asset but a different pocket, and a player looking for where their
   * laundering proceeds went should find them named. Omitting it here would
   * reopen the exact gap this module exists to close - the headline counting a
   * term the itemised list below it does not.
   */
  // Same strict validation as the canonical `netWorth()` - `typeof === 'number'`
  // rather than `Number(x)`, so a persisted string like "2" gets no row, and the
  // product clamped so two finite values cannot multiply to Infinity.
  const btcPrice = (gameState.cryptos ?? []).find((c) => c?.id === 'btc')?.price;
  const cleanBtc = gameState.darkWeb?.cleanBtc;
  if (
    typeof btcPrice === 'number' && isFinite(btcPrice) && btcPrice > 0 &&
    typeof cleanBtc === 'number' && isFinite(cleanBtc) && cleanBtc > 0
  ) {
    assets.push({
      id: 'darkweb_clean_btc',
      type: 'investment',
      baseValue: Math.min(Number.MAX_SAFE_INTEGER, cleanBtc * btcPrice),
      group: 'crypto',
      rowName: 'Bitcoin (laundered)',
    });
  }

  // Stocks - held holdings at their current price.
  (gameState.stocks?.holdings || []).forEach((h, i) => {
    const value = (h?.shares || 0) * (h?.currentPrice || 0);
    if (value <= 0) return;
    assets.push({
      id: `stock_${h?.symbol ?? i}`,
      type: 'investment',
      baseValue: value,
      group: 'stocks',
      rowName: h?.symbol || `Holding ${i + 1}`,
    });
  });

  // Luxury - resale value per piece, condition and appreciation included,
  // matching what a sale would actually pay. `getLuxuryHoldingValue` is the
  // same helper `getTotalLuxuryMarketValue` reduces over, so a row and the
  // headline physically cannot price the same trophy differently.
  getOwnedLuxuryItems(gameState.luxuryItems).forEach((item, i) => {
    const value = getLuxuryHoldingValue(item, gameState.luxuryHoldings?.[item.id]);
    if (value <= 0) return;
    assets.push({
      id: `luxury_${item.id ?? i}`,
      type: 'luxury',
      baseValue: value,
      group: 'luxury',
      rowName: item.name || item.id,
    });
  });

  (items || [])
    .filter((i) => i?.owned)
    .forEach((item) =>
      assets.push({
        id: item.id,
        type: 'item',
        baseValue: item.price,
        group: 'item',
        rowName: item.name || item.id,
      }),
    );

  companies?.forEach((company) => {
    assets.push({
      id: company.id,
      type: 'business',
      baseValue: 0,
      trailingWeeklyProfit: company.weeklyIncome,
      // Annualised, matching the canonical calculation (weekly × 52). The old
      // 10x multiple was a third answer to what a company is worth.
      valuationMultiple: WEEKS_PER_YEAR,
      group: 'business',
      rowName: company.name || company.id,
    });
    Object.entries(company.miners || {}).forEach(([id, count]) => {
      const price = MINER_PRICES[id as keyof typeof MINER_PRICES];
      if (price && (count as number) > 0) {
        assets.push({
          id: `${company.id}_miner_${id}`,
          type: 'hardware',
          baseValue: price * (count as number),
          group: 'hardware',
          rowName: `${company.name || company.id} - ${id} Miner${(count as number) > 1 ? 's' : ''} (${count}x)`,
        });
      }
    });
  });

  // Real Estate - CURRENT value, not what was paid for it.
  (realEstate || [])
    .filter((p) => p?.owned)
    .forEach((p) =>
      assets.push({
        id: p.id,
        type: 'property',
        baseValue: p.currentValue ?? p.price,
        group: 'property',
        rowName: p.name || p.id,
      }),
    );

  /**
   * Vehicles, validated EXACTLY as the canonical `netWorth()` validates them
   * (`lib/progress/achievements.ts`) - same guards, same fallbacks, same
   * depreciation, so the two answers cannot drift.
   *
   * The guards are not defensive decoration. `condition` was read as
   * `vehicle.condition / 100` with no fallback while `mileage` got a `|| 0`, so
   * ONE legacy or hand-edited row with a missing `condition` or `price` produced
   * `NaN`, and `computeNetWorth` summed it into `totalAssets`. The headline,
   * every percentage and `netWorth` itself would all render as `NaN` - a single
   * bad row poisoning the entire modal. This code was moved verbatim out of the
   * component, so the hole came with it.
   *
   * No `owned` filter, deliberately: selling REMOVES the vehicle from the array
   * (`VehicleActions`), so a lingering `owned: false` row is not a state the
   * game produces, and the canonical calculation does not filter either.
   */
  (vehicles || []).forEach((vehicle) => {
    if (!vehicle) return;
    const price =
      typeof vehicle.price === 'number' && isFinite(vehicle.price) && vehicle.price >= 0 ? vehicle.price : 0;
    const condition =
      typeof vehicle.condition === 'number' &&
      isFinite(vehicle.condition) &&
      vehicle.condition >= 0 &&
      vehicle.condition <= 100
        ? vehicle.condition
        : 100;
    const mileage =
      typeof vehicle.mileage === 'number' && isFinite(vehicle.mileage) && vehicle.mileage >= 0
        ? vehicle.mileage
        : 0;
    if (price <= 0) return;

    const baseSellPercent = 0.8;
    const conditionMultiplier = 0.2 + (condition / 100) * 0.8;
    const mileagePenalty = Math.min(0.3, mileage / 500000);
    const depreciatedValue = price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
    if (!isFinite(depreciatedValue) || depreciatedValue <= 0) return;

    assets.push({
      id: vehicle.id,
      type: 'vehicle',
      baseValue: Math.floor(depreciatedValue),
      group: 'vehicle',
      rowName: vehicle.name || vehicle.id,
    });
  });

  // Debt is part of net worth. The modal used to pass an empty array here, so
  // loans and mortgages simply did not count against the headline.
  const liabilities: Liability[] = (gameState.loans || [])
    .filter((l) => (l?.remaining || 0) > 0)
    .map((l) => ({ id: l.id, type: 'loan', principal: l.remaining }));

  // Revolving credit-card debt, which the canonical `netWorth()` subtracts and
  // the modal used to ignore - so a player carrying a balance saw a headline
  // ABOVE the card that opened it. Same helper canonical uses, guarded because a
  // partial save can carry `banking` without a `creditCards` array.
  const creditCardDebt = totalCreditCardDebt({
    ...(gameState.banking ?? {}),
    creditCards: gameState.banking?.creditCards ?? [],
  } as never);
  if (isFinite(creditCardDebt) && creditCardDebt > 0) {
    liabilities.push({ id: 'credit-card-debt', type: 'creditCard', principal: creditCardDebt });
  }

  // `transactionFee: 0` - this breakdown exists to EXPLAIN the canonical
  // `netWorth()` shown on the card that opens it, and that figure applies no
  // liquidation haircut. Passing the default fee shaved ~1% off every asset, so
  // the modal total sat just below the card. With the fee off, `perAsset`
  // equals each asset's valued contribution exactly, so the folded rows below
  // sum to the headline with no rounding drift beyond the display round.
  const breakdown = computeNetWorth(assets, liabilities, { transactionFee: 0 });

  // Fold the per-asset values back into display groups. Reading `perAsset`
  // rather than the inputs keeps the rows honest: it is the exact per-asset
  // contribution `computeNetWorth` summed into the headline.
  const totals = new Map<NetWorthGroup, { value: number; items: { name: string; value: number }[] }>();
  assets.forEach((asset, i) => {
    const value = breakdown.perAsset[i] ?? 0;
    const bucket = totals.get(asset.group) ?? { value: 0, items: [] };
    bucket.value += value;
    bucket.items.push({ name: asset.rowName, value: Math.round(value) });
    totals.set(asset.group, bucket);
  });

  const rows: NetWorthGroupRow[] = [];
  for (const group of NET_WORTH_GROUPS) {
    const bucket = totals.get(group);
    if (!bucket || bucket.value <= 0) continue;
    rows.push({ group, value: Math.round(bucket.value), items: bucket.items });
  }

  return { breakdown, rows };
}
