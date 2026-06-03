/**
 * Neighborhood market dynamics for RealEstateApp Remake 4.
 *
 * Each property carries a `neighborhood` tag (assigned at purchase or seeded).
 * Neighborhoods evolve through cycles: stable → gentrifying → hot → cooling.
 *
 * Cycles affect:
 *   - Property appreciation rate
 *   - Market rent (drives tenant satisfaction calc)
 *   - Vacancy hazard (tenants move out faster in cooling, find tenant faster in hot)
 *
 * Pure functions. Deterministic when given a seeded roll source.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type NeighborhoodCycle = 'stable' | 'gentrifying' | 'hot' | 'cooling';

export interface CycleParams {
  /** Weekly appreciation multiplier applied on top of the base 0.1%/week. */
  appreciationMultiplier: number;
  /** Market rent multiplier (>1 means landlords can charge more). */
  rentMultiplier: number;
  /** Demand factor — feeds tenancy.findTenantProbability. */
  demandFactor: number;
  /** Mean weeks the cycle persists before re-rolling. */
  meanDurationWeeks: number;
}

export const CYCLE_PARAMS: Record<NeighborhoodCycle, CycleParams> = {
  stable:       { appreciationMultiplier: 1.0,  rentMultiplier: 1.00, demandFactor: 1.0, meanDurationWeeks: 26 },
  gentrifying:  { appreciationMultiplier: 2.5,  rentMultiplier: 1.15, demandFactor: 1.3, meanDurationWeeks: 16 },
  hot:          { appreciationMultiplier: 4.0,  rentMultiplier: 1.30, demandFactor: 1.6, meanDurationWeeks: 12 },
  cooling:      { appreciationMultiplier: 0.2,  rentMultiplier: 0.92, demandFactor: 0.6, meanDurationWeeks: 14 },
};

/**
 * Transition probabilities between cycles. Rows sum to 1.
 * Stable can spawn anything; hot tends to cool; cooling tends back to stable;
 * gentrifying tends to escalate to hot.
 */
const TRANSITIONS: Record<NeighborhoodCycle, Record<NeighborhoodCycle, number>> = {
  stable:      { stable: 0.55, gentrifying: 0.25, hot: 0.05, cooling: 0.15 },
  gentrifying: { stable: 0.20, gentrifying: 0.35, hot: 0.35, cooling: 0.10 },
  hot:         { stable: 0.10, gentrifying: 0.05, hot: 0.40, cooling: 0.45 },
  cooling:     { stable: 0.55, gentrifying: 0.10, hot: 0.05, cooling: 0.30 },
};

export function nextCycle(current: NeighborhoodCycle, roll: number): NeighborhoodCycle {
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  const probs = TRANSITIONS[current];
  let cum = 0;
  for (const cycle of Object.keys(probs) as NeighborhoodCycle[]) {
    cum += probs[cycle];
    if (r < cum) return cycle;
  }
  return 'stable';
}

/**
 * Sample a fresh cycle duration. Geometric-ish around the mean.
 */
export function sampleCycleDuration(cycle: NeighborhoodCycle, roll: number): number {
  const mean = CYCLE_PARAMS[cycle].meanDurationWeeks;
  const r = Math.max(0.01, Math.min(0.99, safe(roll, 0.5)));
  const d = Math.round(-mean * Math.log(1 - r));
  return Math.max(4, Math.min(mean * 3, d));
}

/**
 * Top-level helper — one call to resolve "what's the appreciation/rent/demand for this property this week".
 */
export function cycleEffects(cycle: NeighborhoodCycle): CycleParams {
  return CYCLE_PARAMS[cycle];
}
