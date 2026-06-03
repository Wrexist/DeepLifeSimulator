/**
 * PAC fundraising — Political Action Committee money pool.
 *
 * Splits campaignFunds into "clean" and "dirty" buckets:
 *   - Clean: cash from the player's stats.money, partner income, allies.
 *     Always usable for legitimate campaign spending.
 *   - Dirty: laundered BTC from the dark-web wallet. Higher conversion rate
 *     (you funnel real value into your campaign), but raises scandal risk.
 *
 * Spending from PAC is more efficient than direct campaign spending (the
 * existing `campaign` action) because pooled money has economies of scale.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface PACState {
  /** Clean USD raised from legitimate sources. */
  cleanUSD: number;
  /** Dirty USD-equivalent raised from laundered BTC. */
  dirtyUSD: number;
  /** Lifetime total dirty money funneled — feeds scandal risk forever. */
  lifetimeDirtyUSD: number;
  /** weeksLived of the last raise event. */
  lastRaiseWeek?: number;
}

export const INITIAL_PAC: PACState = {
  cleanUSD: 0,
  dirtyUSD: 0,
  lifetimeDirtyUSD: 0,
};

/**
 * Clean PAC contribution from a sympathetic donor. 100% conversion — the
 * donor's USD becomes PAC USD.
 */
export function raiseClean(pac: PACState, amountUSD: number, currentWeek: number): PACState {
  const amt = Math.max(0, safe(amountUSD));
  return {
    ...pac,
    cleanUSD: safe(pac.cleanUSD) + amt,
    lastRaiseWeek: currentWeek,
  };
}

/**
 * Dirty BTC contribution — money laundered through the campaign. Higher
 * conversion (you get $1 PAC per $1 funneled — the "campaign laundering" trick)
 * but it permanently increases scandal exposure via lifetimeDirtyUSD.
 *
 * @param btcAmount BTC moved from the dark-web clean wallet into the PAC.
 * @param btcPrice current BTC price for USD conversion.
 */
export function raiseDirty(
  pac: PACState,
  btcAmount: number,
  btcPrice: number,
  currentWeek: number
): { pac: PACState; usdConverted: number } {
  const amt = Math.max(0, safe(btcAmount));
  const price = Math.max(0, safe(btcPrice));
  const usd = amt * price;
  return {
    pac: {
      ...pac,
      dirtyUSD: safe(pac.dirtyUSD) + usd,
      lifetimeDirtyUSD: safe(pac.lifetimeDirtyUSD) + usd,
      lastRaiseWeek: currentWeek,
    },
    usdConverted: usd,
  };
}

/**
 * Spend from the PAC. Pulls from the clean bucket first, then dirty.
 *
 * Spending from PAC is MORE EFFICIENT than the legacy `campaign` action:
 * $1 PAC → 1.5 approval points (vs. ~1 for direct spend).
 *
 * Returns the new PAC state, the approval bump, and the USD actually spent.
 */
export function spendPAC(
  pac: PACState,
  amountUSD: number
): { pac: PACState; approvalGain: number; spentUSD: number; spentFromDirty: number } {
  const want = Math.max(0, safe(amountUSD));
  const total = safe(pac.cleanUSD) + safe(pac.dirtyUSD);
  const spent = Math.min(want, total);
  // Pull from clean first.
  const fromClean = Math.min(safe(pac.cleanUSD), spent);
  const fromDirty = spent - fromClean;
  const approvalGain = Math.min(15, spent / 10_000); // diminishing returns capped at +15
  return {
    pac: {
      ...pac,
      cleanUSD: safe(pac.cleanUSD) - fromClean,
      dirtyUSD: safe(pac.dirtyUSD) - fromDirty,
    },
    approvalGain,
    spentUSD: spent,
    spentFromDirty: fromDirty,
  };
}

/**
 * Total PAC pool (clean + dirty), for the UI summary card.
 */
export function totalPAC(pac: PACState): number {
  return safe(pac.cleanUSD) + safe(pac.dirtyUSD);
}
