/**
 * Crypto market pricing model.
 *
 * Replaces the legacy "prices are static forever" behaviour with a regime-driven
 * random walk:
 *
 *   - Each coin is always in exactly one regime (stable, volatile, bull, bear)
 *     for N weeks. When the regime expires, a new one is chosen by transition
 *     probabilities and news-event modifiers.
 *   - Per-week price change = drift(regime) + walk(regime, seed) + news shock.
 *   - Drift/volatility/spread differ per regime so the player can feel the
 *     difference between holding through a bull and through a bear.
 *
 * Pure functions. No game state, no React, no PRNG of our own — callers pass a
 * deterministic [0,1) roll so the weekly tick stays reproducible under the
 * existing seeded preRolls.
 */

export type CryptoRegime = 'stable' | 'volatile' | 'bull' | 'bear';

export interface RegimeParams {
  /** Mean weekly return as a decimal (0.01 = +1%/wk). */
  meanReturn: number;
  /** Standard deviation of weekly returns. */
  volatility: number;
  /** Bid/ask spread as a fraction of price. Higher in volatile regimes. */
  bidAskSpread: number;
  /** Mean weeks the regime persists before re-rolling. */
  meanDurationWeeks: number;
}

export const REGIME_PARAMS: Record<CryptoRegime, RegimeParams> = {
  stable:   { meanReturn:  0.0010, volatility: 0.020, bidAskSpread: 0.002, meanDurationWeeks: 16 },
  volatile: { meanReturn:  0.0000, volatility: 0.080, bidAskSpread: 0.010, meanDurationWeeks: 6 },
  bull:     { meanReturn:  0.0150, volatility: 0.045, bidAskSpread: 0.004, meanDurationWeeks: 10 },
  bear:     { meanReturn: -0.0120, volatility: 0.050, bidAskSpread: 0.006, meanDurationWeeks: 10 },
};

/**
 * Transition matrix: P(next regime | current regime).
 * Rows sum to 1. Designed so volatile is a hub (it can flip to anything),
 * bull/bear tend to mean-revert to stable, and stable can spawn either trend.
 */
const TRANSITIONS: Record<CryptoRegime, Record<CryptoRegime, number>> = {
  stable:   { stable: 0.55, volatile: 0.15, bull: 0.20, bear: 0.10 },
  volatile: { stable: 0.30, volatile: 0.25, bull: 0.20, bear: 0.25 },
  bull:     { stable: 0.45, volatile: 0.15, bull: 0.30, bear: 0.10 },
  bear:     { stable: 0.45, volatile: 0.15, bull: 0.10, bear: 0.30 },
};

const safe = (n: number, fb = 0): number => (typeof n === 'number' && isFinite(n) ? n : fb);

/**
 * Pick the next regime given the current one and a roll in [0, 1).
 */
export function nextRegime(current: CryptoRegime, roll: number): CryptoRegime {
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  const probs = TRANSITIONS[current];
  let cum = 0;
  for (const regime of Object.keys(probs) as CryptoRegime[]) {
    cum += probs[regime];
    if (r < cum) return regime;
  }
  return 'stable';
}

/**
 * Box-Muller-ish normal sample from two uniform [0,1) rolls.
 * We only need an approximation; reproducible & no Math.random.
 */
function gaussian(u1: number, u2: number): number {
  const a = Math.max(1e-9, safe(u1, 0.5));
  const b = safe(u2, 0.5);
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

/**
 * One-week price step. Returns the new price.
 *
 * @param currentPrice - last observed price
 * @param regime - the regime for this week
 * @param rolls - two seeded uniform rolls in [0,1)
 * @param newsShock - optional news-driven extra return (e.g. +0.20 for ETF approval, -0.30 for hack)
 */
export function stepPrice(
  currentPrice: number,
  regime: CryptoRegime,
  rolls: { u1: number; u2: number },
  newsShock = 0
): number {
  const p = Math.max(0.0001, safe(currentPrice, 1));
  const params = REGIME_PARAMS[regime];
  const z = gaussian(rolls.u1, rolls.u2);
  const drift = params.meanReturn + safe(newsShock);
  const ret = drift + params.volatility * z;
  // Clamp the per-week return to ±60% to avoid pathological tails.
  const clampedReturn = Math.max(-0.6, Math.min(0.6, ret));
  const next = p * (1 + clampedReturn);
  return safe(next, p) > 0 ? safe(next, p) : 0.0001;
}

/**
 * Sample a fresh regime duration in weeks. Geometric-ish around the regime mean.
 */
export function sampleRegimeDuration(regime: CryptoRegime, roll: number): number {
  const mean = REGIME_PARAMS[regime].meanDurationWeeks;
  const r = Math.max(0.01, Math.min(0.99, safe(roll, 0.5)));
  // Geometric distribution: -mean * ln(1 - r). Clamp 1..3*mean.
  const d = Math.round(-mean * Math.log(1 - r));
  return Math.max(2, Math.min(mean * 3, d));
}

/**
 * Map a global economy state (from lib/events/economyEvents.ts) onto a forced regime override.
 * A `null` return means the regime engine should not be forced this tick.
 */
export function regimeFromEconomyState(
  economyState: 'normal' | 'recession' | 'boom' | 'crash' | undefined
): CryptoRegime | null {
  if (!economyState) return null;
  switch (economyState) {
    case 'crash':
      return 'bear';
    case 'recession':
      return 'volatile';
    case 'boom':
      return 'bull';
    case 'normal':
    default:
      return null;
  }
}
