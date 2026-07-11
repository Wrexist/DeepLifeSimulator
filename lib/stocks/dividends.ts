/**
 * Quarterly stock dividends.
 *
 * The legacy `lib/economy/stockMarket.ts` records a per-stock `dividendYield`
 * but never pays anything out. We pay dividends every 13 weeks (quarterly,
 * 52 weeks / 4), based on the player's shares × current price × annual yield ÷ 4.
 *
 * Pure functions.
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Weeks per dividend cycle (quarterly). */
export const DIVIDEND_INTERVAL_WEEKS = 13;

export interface DividendPayout {
  symbol: string;
  shares: number;
  pricePerShare: number;
  annualYield: number;
  payoutUSD: number;
}

/**
 * Compute one quarter's dividend on a holding.
 */
export function quarterlyDividend(
  shares: number,
  pricePerShare: number,
  annualYield: number
): number {
  const s = Math.max(0, safe(shares));
  const p = Math.max(0, safe(pricePerShare));
  const y = Math.max(0, safe(annualYield));
  return s * p * (y / 4);
}

/**
 * Should a payout fire this week? Quarterly cycle: weeksLived 0 = inception,
 * payouts at weeks 13, 26, 39, 52, etc.
 */
export function isDividendWeek(currentWeek: number): boolean {
  const w = Math.max(0, safe(currentWeek));
  return w > 0 && w % DIVIDEND_INTERVAL_WEEKS === 0;
}

/**
 * Compute all dividends owed to the player this tick.
 *
 * @param holdings each holding's shares, current price
 * @param yields per-symbol annual yield from the stockMarket sim
 * @returns list of payouts (one per dividend-paying holding)
 */
export function computePayouts(
  holdings: { symbol: string; shares: number; currentPrice: number }[],
  yields: Record<string, number>
): DividendPayout[] {
  const out: DividendPayout[] = [];
  for (const h of holdings ?? []) {
    const sym = (h?.symbol ?? '').toUpperCase();
    const y = Math.max(0, safe(yields[sym], 0));
    if (y === 0) continue;
    const payout = quarterlyDividend(h.shares, h.currentPrice, y);
    if (payout <= 0) continue;
    out.push({
      symbol: sym,
      shares: h.shares,
      pricePerShare: h.currentPrice,
      annualYield: y,
      payoutUSD: payout,
    });
  }
  return out;
}

/**
 * Sum total dividends paid this tick.
 */
export function sumPayouts(payouts: DividendPayout[]): number {
  return payouts.reduce((s, p) => s + safe(p.payoutUSD), 0);
}

/**
 * Next value of the YTD dividend counter (`stocks.dividendsThisYear`).
 *
 * The field's type contract says it "resets at year boundary", but its only
 * writer always accumulated, so it grew forever and converged on the lifetime
 * `totalDividends`. This honors the contract by zeroing it on the 52-week game
 * year boundary (mirroring crypto's `realizedGainsThisYear` reset at
 * `week % 52 === 0`); every other week it accumulates this tick's payout.
 *
 * Pure. `currentWeek` is the post-advance week (weeksLived) — no wall-clock.
 */
export function accumulateDividendsThisYear(
  prev: number,
  paidThisTick: number,
  currentWeek: number
): number {
  const w = Math.max(0, safe(currentWeek));
  if (w > 0 && w % 52 === 0) return 0; // year boundary — start the new YTD fresh
  return Math.max(0, safe(prev)) + Math.max(0, safe(paidThisTick));
}
