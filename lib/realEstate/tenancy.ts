/**
 * Tenant lifecycle for rental properties.
 *
 * Replaces the simple `rented` boolean with a real model:
 *   - Find tenant: takes weeks of vacancy → eventually a tenant moves in
 *   - Satisfaction: decays with poor condition, ages with neglect, recovers with upgrades
 *   - Churn: low satisfaction increases the chance a tenant moves out
 *   - Rent modes: longTerm (steady), airbnb (variable + higher mean), commercial (highest, business-only)
 *
 * Pure functions. Caller threads results into setGameState.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type RentMode = 'longTerm' | 'airbnb' | 'commercial';

/** Per-mode characteristics. */
export const RENT_MODE_PARAMS: Record<RentMode, {
  /** Expected income as a fraction of property value per week. */
  weeklyYieldMean: number;
  /** Standard deviation of weekly yield (Airbnb has higher variance). */
  weeklyYieldStdev: number;
  /** Probability per week that a long-term lease ends or Airbnb has an empty week. */
  vacancyHazard: number;
  /** Satisfaction decay multiplier — Airbnb churns guests so satisfaction matters less. */
  satisfactionDecayWeight: number;
}> = {
  longTerm:   { weeklyYieldMean: 0.0015, weeklyYieldStdev: 0.0001, vacancyHazard: 0.01, satisfactionDecayWeight: 1.0 },
  airbnb:     { weeklyYieldMean: 0.0028, weeklyYieldStdev: 0.0015, vacancyHazard: 0.20, satisfactionDecayWeight: 0.3 },
  commercial: { weeklyYieldMean: 0.0020, weeklyYieldStdev: 0.0004, vacancyHazard: 0.005, satisfactionDecayWeight: 0.6 },
};

export interface TenantSnapshot {
  /** Unique tenant id (auto-generated when they move in). */
  id: string;
  /** Display name for the UI. */
  name: string;
  /** Satisfaction 0..100. Drives churn probability. */
  satisfaction: number;
  /** weeksLived when they moved in. Used for lease-length anniversary, gentrification carryover. */
  movedInWeek: number;
  /** Weekly rent paid (set at move-in, can be revised on renewal). */
  weeklyRent: number;
}

/**
 * Compute a tenant's satisfaction change for one week given the property condition
 * and the current rent vs market expectations.
 *
 *   - Poor condition (<50) decays satisfaction
 *   - Excellent condition (>80) restores satisfaction
 *   - Overcharging (rent > marketRent × 1.2) decays satisfaction
 *   - Undercharging (rent < marketRent × 0.8) gives a small boost
 */
export function satisfactionStep(
  current: number,
  condition: number,
  weeklyRent: number,
  marketWeeklyRent: number,
  mode: RentMode
): number {
  const cur = Math.max(0, Math.min(100, safe(current, 80)));
  const cond = Math.max(0, Math.min(100, safe(condition, 70)));
  const rent = Math.max(0, safe(weeklyRent));
  const market = Math.max(1, safe(marketWeeklyRent, 1));
  const weight = RENT_MODE_PARAMS[mode].satisfactionDecayWeight;

  let delta = 0;
  // Condition contribution: −2 to +2 per week.
  if (cond < 50) delta -= (50 - cond) * 0.04;
  else if (cond > 80) delta += (cond - 80) * 0.05;

  // Rent contribution.
  const rentRatio = rent / market;
  if (rentRatio > 1.2) delta -= (rentRatio - 1.2) * 10;
  else if (rentRatio < 0.8) delta += (0.8 - rentRatio) * 5;

  return Math.max(0, Math.min(100, cur + delta * weight));
}

/**
 * Probability the tenant moves out this week given satisfaction + mode.
 *
 *   - Long-term lease at sat≥70: ~1% baseline.
 *   - Long-term lease at sat=30: ~8%.
 *   - Long-term lease at sat=0:  ~20%.
 *   - Airbnb has 20% baseline (every week is a coin flip on occupancy).
 */
export function moveOutProbability(satisfaction: number, mode: RentMode): number {
  const base = RENT_MODE_PARAMS[mode].vacancyHazard;
  const sat = Math.max(0, Math.min(100, safe(satisfaction, 80)));
  if (mode === 'airbnb') return base; // not satisfaction-driven for Airbnb
  // Long-term / commercial: convex penalty as sat drops
  const dissatisfactionPenalty = Math.max(0, (50 - sat) / 50) * 0.20;
  return Math.max(0, Math.min(1, base + dissatisfactionPenalty));
}

/**
 * Probability a vacant property finds a new tenant this week.
 * Higher in hot neighborhoods, lower with poor condition.
 */
export function findTenantProbability(condition: number, neighborhoodDemand: number): number {
  const cond = Math.max(0, Math.min(100, safe(condition, 70))) / 100;
  const demand = Math.max(0, Math.min(2, safe(neighborhoodDemand, 1)));
  // Baseline: 30% per week in a healthy neighborhood with good condition.
  return Math.max(0, Math.min(0.9, 0.3 * cond * demand));
}

// ---------------------------------------------------------------------------
// Player-set ("asked") rent — realized income + tenant behavior shift.
// ---------------------------------------------------------------------------
//
// `property.rent` is the weekly rent the player asks for (set via
// setPropertyRentMode). Historically it only moved UI projections: tenants paid
// the computed marketRent instead. These helpers make the ask real:
//   - occupied income uses the asked rent (clamped to the value ceiling), and
//   - the seeded fill/churn rolls shift with the ask relative to market.
// Tuned so no single ask strictly dominates: a modest premium is best, while the
// max ask's fill/churn penalty (below) drops steady-state occupancy far enough
// that its higher per-week rent nets LESS than renting at/near market.

/**
 * Player-set ("asked") rent ceiling as a fraction of property value per week.
 * Mirrors the cap enforced at set-time in setPropertyRentMode (RealEstateActions.ts,
 * `price * 0.004`) so tickProperty realizes at most what the UI let the player ask.
 */
export const ASK_RENT_CEILING_RATE = 0.004;

/**
 * Resolve the effective weekly rent a tenant actually pays: the player's asked
 * rent clamped to [0, value × ASK_RENT_CEILING_RATE]. Falls back to `marketRent`
 * when no ask is set (undefined / non-positive) so legacy rentals — and any unit
 * whose `rent` was never configured — behave exactly as before.
 */
export function effectiveAskRent(
  askRent: number | undefined,
  propertyValue: number,
  marketRent: number
): number {
  const market = Math.max(0, safe(marketRent));
  const ask = safe(askRent, 0);
  if (ask <= 0) return market;
  const ceiling = Math.max(0, safe(propertyValue)) * ASK_RENT_CEILING_RATE;
  return ceiling > 0 ? Math.min(ask, ceiling) : ask;
}

/** Ask/market ratio, clamped to a sane band (market floored at 1 to avoid /0). */
function askRatio(askRent: number, marketRent: number): number {
  const market = Math.max(1, safe(marketRent, 1));
  return Math.max(0, safe(askRent, market)) / market;
}

/**
 * Multiplier on the vacancy→tenant FILL probability driven by the ask. Below
 * market fills faster (>1); above market fills slower (<1). Bounded so it can
 * neither zero-out nor explode. e.g. ratio 0.5→1.25, 1→1, 2→~0.45, 2.67→~0.33.
 */
export function askFillMultiplier(askRent: number, marketRent: number): number {
  const r = askRatio(askRent, marketRent);
  const mult = r <= 1 ? 1 + (1 - r) * 0.5 : 1 / (1 + (r - 1) * 1.2);
  return Math.max(0.15, Math.min(1.5, mult));
}

/**
 * Multiplier on the tenant CHURN (move-out) probability driven by the ask. Above
 * market churns more (>1); at/below market adds nothing (1). Bounded. Combined
 * with the satisfaction hit overcharging already causes, this is what keeps the
 * max ask from dominating. e.g. ratio 1→1, 1.5→1.3, 2.67→2.0.
 */
export function askChurnMultiplier(askRent: number, marketRent: number): number {
  const r = askRatio(askRent, marketRent);
  const mult = r <= 1 ? 1 : 1 + (r - 1) * 0.6;
  return Math.max(1, Math.min(3, mult));
}

/**
 * Compute the realized weekly rent for a property given mode + seeded variance roll.
 *
 *  - longTerm: deterministic `weeklyRent`.
 *  - airbnb: weeklyRent × multiplier where multiplier ∈ [0.4, 1.8] from gaussian-ish roll.
 *  - commercial: deterministic `weeklyRent` with small variance.
 */
export function realizedWeeklyRent(
  weeklyRent: number,
  mode: RentMode,
  rolls: { u1: number; u2: number }
): number {
  const rent = Math.max(0, safe(weeklyRent));
  if (mode === 'longTerm') return rent;
  const params = RENT_MODE_PARAMS[mode];
  // Cheap approximate normal via Box-Muller-ish.
  const u1 = Math.max(1e-9, safe(rolls.u1, 0.5));
  const u2 = safe(rolls.u2, 0.5);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const std = params.weeklyYieldStdev / params.weeklyYieldMean;
  const multiplier = Math.max(0.3, Math.min(2.0, 1 + std * z * 10));
  return rent * multiplier;
}

/**
 * Generate a new tenant. Caller supplies seeded rolls; we keep names simple.
 */
export function generateTenant(
  marketRent: number,
  currentWeek: number,
  rollName: number
): TenantSnapshot {
  const FIRST = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Rowan', 'Avery', 'Quinn', 'Dakota'];
  const LAST = ['Smith', 'Lee', 'Patel', 'Garcia', 'Chen', 'Walker', 'Reyes', 'Rivera', 'Singh', 'Brooks'];
  const r = Math.max(0, Math.min(0.9999, safe(rollName, 0.5)));
  const first = FIRST[Math.floor(r * FIRST.length)];
  const last = LAST[Math.floor((r * 100) % LAST.length)];
  // DETERMINISM: derive the id suffix from the seeded `rollName` instead of
  // Math.random — tickProperty is weekly-tick code and must be reproducible
  // (Math.random here made the tenant id, and thus the `re.move.*`/`re.rent.*`
  // roll keys, diverge across save/reload). `currentWeek` keeps ids unique
  // week-over-week even when the property's name roll is stable.
  const idSuffix = Math.floor(r * 1e6).toString(36);
  return {
    id: `tenant-${currentWeek}-${idSuffix}`,
    name: `${first} ${last}`,
    satisfaction: 85, // tenants start optimistic
    movedInWeek: currentWeek,
    weeklyRent: Math.max(0, safe(marketRent)),
  };
}
