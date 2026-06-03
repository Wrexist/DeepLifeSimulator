/**
 * Crypto laundering chain.
 *
 * Dirty BTC from dark-web jobs can't be deposited at an exchange directly —
 * it has to be cycled through a mixer first. Mixers take a fee and a delay
 * (weeks of cool-down) and produce clean BTC the player can sell or cash out.
 *
 * Pure math + state-shape helpers.
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type MixerTier = 'cheap' | 'standard' | 'premium';

export interface MixerParams {
  feePct: number;   // 0.05 = 5%
  delayWeeks: number;
  /** Probability the mixer is a sting / exit-scam this run. */
  failProbability: number;
}

export const MIXER_TIERS: Record<MixerTier, MixerParams> = {
  cheap:    { feePct: 0.02, delayWeeks: 1, failProbability: 0.20 },
  standard: { feePct: 0.06, delayWeeks: 3, failProbability: 0.05 },
  premium:  { feePct: 0.15, delayWeeks: 6, failProbability: 0.005 },
};

export interface LaunderingTx {
  id: string;
  /** Mixer tier used. */
  tier: MixerTier;
  /** BTC sent in (gross). */
  dirtyAmountBtc: number;
  /** BTC expected out (after fee). */
  netAmountBtc: number;
  startedWeek: number;
  /** weeksLived when funds become available. */
  readyWeek: number;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Compute the net BTC after the mixer fee.
 * Caller is responsible for charging the dirty wallet before calling.
 */
export function computeNetLaunder(dirtyAmountBtc: number, tier: MixerTier): number {
  const amt = Math.max(0, safe(dirtyAmountBtc));
  return amt * (1 - MIXER_TIERS[tier].feePct);
}

/**
 * Decide whether the mixer fails this run, given a seeded roll in [0, 1).
 * On failure the dirty BTC is lost.
 */
export function mixerFails(tier: MixerTier, roll: number): boolean {
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  return r < MIXER_TIERS[tier].failProbability;
}

/**
 * Skill bonus: each level of Laundering reduces fees by 0.5% (multiplicatively
 * stacked with mixer fee). Max bonus at level 10: 5% off the fee.
 */
export function effectiveFeePct(tier: MixerTier, launderingSkillLevel: number): number {
  const baseFee = MIXER_TIERS[tier].feePct;
  const lvl = Math.max(0, Math.min(10, safe(launderingSkillLevel, 0)));
  const reduction = lvl * 0.005;
  return Math.max(0, baseFee - reduction);
}

/**
 * Companies-as-fronts discount.
 *
 * Owning a restaurant or bank lets you mix money through a legitimate front,
 * which cuts the mixer's effective fee and shortens its delay. Multiple fronts
 * stack with diminishing returns (capped at 4 fronts).
 *
 *   Each front: -0.5% fee, -1 week delay
 *   Cap: 4 fronts → -2% fee, -4 weeks delay (down to a minimum of 1 week)
 */
export function frontDiscount(frontCount: number): { feeReduction: number; delayReductionWeeks: number } {
  const n = Math.max(0, Math.min(4, Math.floor(safe(frontCount, 0))));
  return {
    feeReduction: n * 0.005,
    delayReductionWeeks: n,
  };
}

/**
 * Combined effective params for a mixer run, given skill level and active fronts.
 */
export function effectiveMixerParams(
  tier: MixerTier,
  launderingSkillLevel: number,
  frontCount: number
): { feePct: number; delayWeeks: number; failProbability: number } {
  const base = MIXER_TIERS[tier];
  const skillReduction = Math.max(0, Math.min(10, safe(launderingSkillLevel, 0))) * 0.005;
  const front = frontDiscount(frontCount);
  return {
    feePct: Math.max(0, base.feePct - skillReduction - front.feeReduction),
    delayWeeks: Math.max(1, base.delayWeeks - front.delayReductionWeeks),
    failProbability: base.failProbability,
  };
}

/**
 * Build a new LaunderingTx record. Caller checks balance + applies the debit.
 *
 * `frontCount` is the number of restaurant/bank companies the player owns —
 * each one cuts the fee by 0.5% and shortens the delay by 1 week (capped at 4).
 */
export function buildLaunderingTx(
  dirtyAmountBtc: number,
  tier: MixerTier,
  startedWeek: number,
  launderingSkillLevel: number,
  frontCount: number = 0
): LaunderingTx {
  const params = effectiveMixerParams(tier, launderingSkillLevel, frontCount);
  const amt = Math.max(0, safe(dirtyAmountBtc));
  return {
    id: `mix-${tier}-${startedWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    tier,
    dirtyAmountBtc: amt,
    netAmountBtc: amt * (1 - params.feePct),
    startedWeek,
    readyWeek: startedWeek + params.delayWeeks,
    status: 'pending',
  };
}
