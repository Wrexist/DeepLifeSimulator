/**
 * Content gear quality — pure score combining accessory equipment (booleans)
 * with PC component tiers (numeric upgrade levels) into a single 0..100.
 *
 * Used by both GamingApp (YouVideo) and GamingStreamingApp to drive view
 * count, viral chance, and monetization rates. Centralising it kills the
 * formula-drift between the two apps.
 */

import { GamingEquipment, PCUpgradeLevels } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const ACCESSORY_WEIGHTS: Record<keyof GamingEquipment, number> = {
  microphone: 5,
  webcam: 4,
  lighting: 4,
  greenScreen: 3,
  gamingChair: 2,
};

/** Per-component weight for PC tiers. Each tier adds `weight * tier` points. */
const PC_TIER_WEIGHTS: Record<keyof PCUpgradeLevels, number> = {
  gpu: 4,
  cpu: 4,
  ram: 2,
  ssd: 2,
  motherboard: 1,
  cooling: 1,
  psu: 1,
  network: 3,
  case: 1,
};

export interface QualityBreakdown {
  total: number; // 0..100
  accessories: number;
  pc: number;
  tier: 'starter' | 'budget' | 'pro' | 'elite';
}

/**
 * Map a numeric score to a named tier for UI badges.
 */
function tierFor(total: number): QualityBreakdown['tier'] {
  if (total >= 80) return 'elite';
  if (total >= 50) return 'pro';
  if (total >= 25) return 'budget';
  return 'starter';
}

export function computeQuality(
  equipment: GamingEquipment | undefined,
  pcLevels: PCUpgradeLevels | undefined
): QualityBreakdown {
  let accessories = 0;
  if (equipment) {
    for (const k of Object.keys(ACCESSORY_WEIGHTS) as (keyof GamingEquipment)[]) {
      if (equipment[k]) accessories += ACCESSORY_WEIGHTS[k];
    }
  }

  let pc = 0;
  if (pcLevels) {
    for (const k of Object.keys(PC_TIER_WEIGHTS) as (keyof PCUpgradeLevels)[]) {
      pc += PC_TIER_WEIGHTS[k] * Math.max(0, safe(pcLevels[k] as number, 0));
    }
  }

  // Total caps at 100. Accessory pool maxes at 18, PC pool grows with tiers.
  const total = Math.max(0, Math.min(100, Math.round(accessories + pc)));
  return {
    total,
    accessories,
    pc,
    tier: tierFor(total),
  };
}

/**
 * Multiplier anchor points — (total score, multiplier). The four values are the
 * historical per-tier multipliers (starter 0.5× / budget 1.0× / pro 1.6× /
 * elite 2.5×), pinned at a representative score inside each band so the smooth
 * curve still passes through them EXACTLY (keeps the pinned unit tests + the
 * pre-existing earnings math bit-for-bit at those scores).
 */
const QUALITY_ANCHORS: readonly (readonly [number, number])[] = [
  [10, 0.5], // starter
  [40, 1.0], // budget
  [60, 1.6], // pro
  [90, 2.5], // elite
] as const;

/**
 * Multiplier applied to views, donations, RPM.
 *
 * Previously a 4-step function keyed on the named tier: buying gear WITHIN a
 * band moved the on-screen 0–100 quality bar but changed earnings by exactly 0
 * (a dead zone between every tier boundary). Now the multiplier is a continuous,
 * monotonic, piecewise-linear interpolation across the total score through the
 * same anchor points — so every point of gear improves earnings — while the tier
 * label (`tierFor`) is still used for UI badges. Flat below the first / above the
 * last anchor. Accepts a `QualityBreakdown` (uses `.total`) or a raw score.
 */
export function qualityMultiplier(q: QualityBreakdown | number): number {
  const total = typeof q === 'number' ? q : q.total;
  const t = Math.max(0, Math.min(100, safe(total, 0)));
  const first = QUALITY_ANCHORS[0];
  const last = QUALITY_ANCHORS[QUALITY_ANCHORS.length - 1];
  if (t <= first[0]) return first[1]; // flat starter floor
  if (t >= last[0]) return last[1]; // flat elite ceiling
  for (let i = 0; i < QUALITY_ANCHORS.length - 1; i++) {
    const [x0, y0] = QUALITY_ANCHORS[i];
    const [x1, y1] = QUALITY_ANCHORS[i + 1];
    if (t >= x0 && t <= x1) {
      const frac = (t - x0) / (x1 - x0);
      return y0 + frac * (y1 - y0);
    }
  }
  return last[1]; // unreachable — the loop above always brackets an in-range t
}
