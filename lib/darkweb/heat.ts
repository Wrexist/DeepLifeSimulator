/**
 * Dark-web "heat" curve. Replaces the binary `wantedLevel` ticker with a
 * persistent investigation pressure meter that decays over time without
 * activity and spikes on failures.
 *
 * Pure functions. No game state. Tested in isolation.
 *
 * Heat is bounded [0, 100]. Above 80 the player should expect bad outcomes
 * (sting operations, raids, informants). The decay function pulls heat back
 * toward 0 over time, modulated by OPSEC skill (higher OPSEC → faster decay).
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const MIN_HEAT = 0;
const MAX_HEAT = 100;

export type HeatBand = 'cold' | 'warm' | 'hot' | 'burning';

export function clampHeat(n: number): number {
  return Math.max(MIN_HEAT, Math.min(MAX_HEAT, safe(n, 0)));
}

export function heatBand(heat: number): HeatBand {
  const h = clampHeat(heat);
  if (h < 20) return 'cold';
  if (h < 50) return 'warm';
  if (h < 80) return 'hot';
  return 'burning';
}

export function heatBandLabel(band: HeatBand): string {
  switch (band) {
    case 'cold':
      return 'Cold';
    case 'warm':
      return 'Warm';
    case 'hot':
      return 'Hot';
    case 'burning':
      return 'Burning';
  }
}

/**
 * Weekly heat decay. Higher OPSEC = faster decay (operations are cleaner).
 * Returns the next heat value. Decay is capped so even a maxed-OPSEC player
 * cant fully zero out from a burning level in one week.
 *
 * Base decay: -3 per week (cold operations leak slowly).
 * OPSEC level 1..10 adds -0.5 per level (max -5).
 */
export function decayHeat(currentHeat: number, opsecLevel: number): number {
  const h = clampHeat(currentHeat);
  if (h === 0) return 0;
  const opsec = Math.max(0, Math.min(10, safe(opsecLevel, 0)));
  const decay = 3 + opsec * 0.5;
  return clampHeat(h - decay);
}

/**
 * Increase heat after a job, scaled by the action's intrinsic heat cost.
 * High-tier OPSEC reduces the increment (but never zeroes it).
 */
export function addHeat(currentHeat: number, heatCost: number, opsecLevel: number): number {
  const h = clampHeat(currentHeat);
  const cost = Math.max(0, safe(heatCost));
  const opsec = Math.max(0, Math.min(10, safe(opsecLevel, 0)));
  // OPSEC mitigates up to 50% of the cost.
  const mitigated = cost * (1 - opsec * 0.05);
  return clampHeat(h + mitigated);
}

/**
 * Probability that a police investigation event fires this tick.
 * - Below 20: 0% (clean operations).
 * - 20–50: 1% per week (rare).
 * - 50–80: 5% per week (noticeable pressure).
 * - 80+: 12% per week (constant risk).
 */
export function policeEventProbability(heat: number): number {
  const h = clampHeat(heat);
  // Raised so high heat actually bites. At the old 0.12 top rate a raid (≈25% of
  // police events) was only ~3%/week even at heat 100 — players never got caught.
  // At 0.40 a police event is 40%/week at max heat (~10%/week is a jail raid),
  // making heat a real threat you have to manage.
  if (h < 20) return 0;
  if (h < 50) return 0.05;
  if (h < 80) return 0.18;
  return 0.40;
}

/**
 * Severity of the police event when one fires, scaled by current heat.
 * Returns a multiplier in [1, 3] that the caller applies to the consequence
 * (e.g. weeks jailed, BTC seized).
 */
export function policeEventSeverity(heat: number): number {
  const h = clampHeat(heat);
  return 1 + (h - 20) / 40; // 20 → 1.0, 60 → 2.0, 100 → 3.0
}
