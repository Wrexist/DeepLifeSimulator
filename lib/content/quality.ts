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
 * Multiplier applied to views, donations, RPM. Maps tier to a real number.
 *   starter 0.5×  budget 1.0×  pro 1.6×  elite 2.5×
 */
export function qualityMultiplier(q: QualityBreakdown | number): number {
  const tier = typeof q === 'number' ? tierFor(q) : q.tier;
  switch (tier) {
    case 'starter': return 0.5;
    case 'budget': return 1.0;
    case 'pro': return 1.6;
    case 'elite': return 2.5;
  }
}
