/**
 * Parenting action loop — type surface.
 *
 * A parenting action is an AGE-APPROPRIATE thing a parent does for a child
 * (read a bedtime story, help with homework, fund tutoring, …). Each one has a
 * small money/energy cost, a per-child cooldown, and modest cumulative effects
 * on the child's NURTURE stats (intelligence / health / happiness / discipline
 * and the bond with the parent).
 *
 * The catalog + pure effect logic live in this module. The nurture stats they
 * raise are read by the existing heir/prestige-child pipeline
 * (childSimulation, childStats, heirGeneration) which prefer them when present.
 */

/** Age bands (inclusive) that gate which actions are available for a child. */
export type ParentingAgeBand = 'baby' | 'toddler' | 'child' | 'teen';

/**
 * Nurture stats a parenting action can move. `relationship` maps to the child's
 * existing `relationshipScore` (bond with the parent); the rest map to the
 * optional nurture fields on `ChildInfo`.
 */
export type NurtureStatKey =
  | 'intelligence'
  | 'health'
  | 'happiness'
  | 'discipline'
  | 'relationship';

/** Signed deltas applied to a child's nurture stats (all clamped 0-100). */
export type ParentingEffect = Partial<Record<NurtureStatKey, number>>;

export interface ParentingAction {
  /** Stable id (also used as the cooldown key). */
  id: string;
  /** Short button label. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
  /** Age bands this action is valid for. */
  bands: ParentingAgeBand[];
  /** Money cost in dollars (>= 0). Deducted via the canonical money path. */
  moneyCost: number;
  /** Energy cost (>= 0). Deducted via stats. */
  energyCost: number;
  /** Weeks that must elapse before this action can be repeated on the same child. */
  cooldownWeeks: number;
  /** Effects on the child's nurture stats (modest + cumulative). */
  effects: ParentingEffect;
  /** lucide-react-native icon name hint for the UI. */
  icon: string;
}

/** Why a parenting action could not be performed. */
export type ParentingRejectReason =
  | 'unknown-action'
  | 'wrong-age'
  | 'cooldown'
  | 'weekly-cap'
  | 'insufficient-money'
  | 'insufficient-energy';

export interface ParentingActionOutcome {
  ok: boolean;
  reason?: ParentingRejectReason;
  /** Updated child (nurture stats + parenting bookkeeping) — present only when ok. */
  child?: import('@/contexts/game/types').ChildInfo;
  /** Money delta to apply through updateMoney/applyMoneyDelta (<= 0). */
  moneyDelta?: number;
  /** Energy delta to apply through updateStats (<= 0). */
  energyDelta?: number;
  /** weeksLived at which the action becomes available again. */
  cooldownUntilWeek?: number;
  /** Effects actually applied (for UI feedback). */
  effectsApplied?: ParentingEffect;
}
