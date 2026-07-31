/**
 * The healthcare half of the enacted-policy effects — read by the code that
 * actually charges for medicine and the code that ticks health.
 *
 * `calculateActivePolicyEffects` aggregates SEVEN policy categories into
 * `politics.activePolicyEffects`. Six of them have a consumer: crypto ->
 * `lib/economy/passiveIncome.ts`, technology -> `RDActions`, transportation ->
 * `lib/travel/transportation.ts`, education -> `EducationActions` (wired in
 * GL-2), real estate and stocks likewise. `healthcare` had none. Its only
 * reader anywhere was `components/computer/PoliticalApp.tsx:249-250`, which
 * RENDERS the numbers to the player — "Health / week +5", "Medical costs −25%"
 * — so the game was advertising an effect it never applied.
 *
 * Three policies carry it (`lib/politics/policies.ts:1191,1208,1226`):
 * universal healthcare (+5/wk, −15%), a subsidy (+3/wk, −25%) and a prevention
 * programme (+4/wk). Enacting all three is worth +12 health a week and half
 * off every doctor visit, hospital stay and vaccine — and did nothing.
 * 2026-07-30 audit GL-3.
 */
import type { GameState } from '@/contexts/game/types';

/**
 * Weekly health that the full policy set can add, with headroom.
 *
 * The aggregator SUMS `healthBonus` across enacted policies with no ceiling of
 * its own, so this is the guard against a corrupt or hand-edited save granting
 * unbounded regen. Real maximum from the shipped catalogue is 12.
 */
const MAX_WEEKLY_HEALTH_BONUS = 25;

/**
 * Cost reduction is stored as a PERCENT, already clamped to 50 by
 * `calculateActivePolicyEffects`. Re-clamped here because that clamp runs at
 * enact time and this reads persisted state, which may predate it.
 */
const MAX_MEDICAL_COST_REDUCTION_PCT = 50;

const NO_HEALTHCARE_PERKS = { weeklyHealthBonus: 0, medicalCostReductionPct: 0 };

/**
 * Medical activities whose price the policy discount applies to.
 *
 * Deliberately the same list as `MEDICAL_ACTIVITY_IDS` in
 * `ItemActionsContext.performHealthActivity`. A gym session or a massage is
 * wellness, not medicine — subsidised healthcare should not discount it.
 */
export const POLICY_DISCOUNTED_ACTIVITY_IDS = [
  'doctor',
  'hospital',
  'experimental',
  'flu_shot',
  'pneumonia_vaccine',
] as const;

export interface HealthcarePolicyPerks {
  /** Health added per week by enacted policy. Already bounded. */
  weeklyHealthBonus: number;
  /** Percent off medical activity prices, 0-50. */
  medicalCostReductionPct: number;
}

/**
 * Read the healthcare effects off persisted state.
 *
 * Every field goes through a finite check and a bound: `Number(Infinity) || 0`
 * is Infinity, so a malformed persisted value would otherwise mean free
 * medicine forever or instant full health. Same defensive shape as
 * `politicsEducationPerks`.
 */
export function healthcarePolicyPerks(state: GameState): HealthcarePolicyPerks {
  const healthcare = state.politics?.activePolicyEffects?.healthcare;
  if (!healthcare) return { ...NO_HEALTHCARE_PERKS };

  const bounded = (v: unknown, max: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };

  return {
    weeklyHealthBonus: bounded(healthcare.healthBonus, MAX_WEEKLY_HEALTH_BONUS),
    medicalCostReductionPct: bounded(
      healthcare.medicalCostReduction,
      MAX_MEDICAL_COST_REDUCTION_PCT,
    ),
  };
}

/**
 * What a health activity costs this player, after any enacted policy discount.
 *
 * Shared by the affordability check in `app/(tabs)/health.tsx`, the
 * "Need $N" lock label, and the debit inside `performHealthActivity`. They must
 * agree: a screen that quotes the list price while the action charges the
 * discounted one shows a locked button the player could actually afford, and
 * the reverse lets them tap into an "insufficient funds" refusal.
 *
 * Rounds DOWN, so the discount is never worse than advertised, and floors at 0.
 */
export function policyAdjustedActivityPrice(
  state: GameState,
  activityId: string,
  listPrice: number,
): number {
  const price = Number(listPrice);
  if (!Number.isFinite(price) || price <= 0) return 0;

  if (!POLICY_DISCOUNTED_ACTIVITY_IDS.includes(activityId as never)) return price;

  const { medicalCostReductionPct } = healthcarePolicyPerks(state);
  if (medicalCostReductionPct <= 0) return price;

  return Math.max(0, Math.floor(price * (1 - medicalCostReductionPct / 100)));
}
