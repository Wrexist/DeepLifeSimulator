/**
 * Inherited Legacy Bonuses - what one life passes to the next, and the ONE
 * place their ceilings and readers live (owner decision D11, 2026-10-23).
 *
 * `legacyBonuses` (income %, learning %, reputation, with heirloom bonuses
 * folded into all three by `computeInheritance`) was computed at every life
 * transition and shown on three screens - the death popup, the Legacy overview
 * and the lineage summary - while nothing in the game applied it. Every value
 * on those screens was a promise the game did not keep.
 *
 * Wired now, each at the seam its system already uses:
 *   - reputation: added ONCE to the opening stats, in the life-creation path
 *     (`applyLegacyBonuses`, both prestige builders). Not on load, so a reload
 *     cannot apply it twice.
 *   - income: a multiplier in `computeWeeklyIncome`, the one place weekly
 *     income is composed.
 *   - learning: folded into the education speed multiplier the tick already
 *     hands `applyEducationProgression`.
 *
 * ## Why the ceilings
 *
 * The base formulas top out at +10% income, +10% learning and +20 reputation,
 * but heirlooms multiply on top WITHOUT a bound: each one adds 5/10/15 to one
 * bonus and a dynasty keeps every heirloom forever, so a long family stacks
 * them indefinitely. Wiring an unbounded multiplier into the paycheck would be
 * a permanent cross-life snowball, which the prestige income curve already
 * exists to prevent.
 *
 *   - income +15%: the base +10% plus room for one heirloom's worth. Small next
 *     to the prestige curve (+50% at its soft cap) because this one is FREE -
 *     it is inherited, not bought with prestige points - and it stacks with it.
 *   - learning +15%: same reasoning, same number.
 *   - reputation +25: the base +20 plus one common heirloom. Reputation is a
 *     0-100 stat and also gates jobs and politics; a bigger head start would
 *     skip the early reputation game outright.
 *
 * The ceilings are applied where the values are COMPUTED as well as where they
 * are read, so every screen shows exactly what is applied; the readers clamp
 * again so a save written before the caps cannot pay more.
 */

import type { GameState } from '@/contexts/game/types';

export const LEGACY_INCOME_BONUS_CAP = 0.15;
export const LEGACY_LEARNING_BONUS_CAP = 0.15;
export const LEGACY_REPUTATION_BONUS_CAP = 25;

export interface LegacyBonusValues {
  incomeMultiplier: number;
  learningMultiplier: number;
  reputationBonus: number;
}

function clampMultiplier(value: unknown, cap: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  return Math.min(1 + cap, Math.max(1, n));
}

function clampReputation(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(LEGACY_REPUTATION_BONUS_CAP, Math.max(0, n));
}

/** The three bonuses within their ceilings. Malformed values read as neutral. */
export function capLegacyBonuses(raw: Partial<LegacyBonusValues> | null | undefined): LegacyBonusValues {
  return {
    incomeMultiplier: clampMultiplier(raw?.incomeMultiplier, LEGACY_INCOME_BONUS_CAP),
    learningMultiplier: clampMultiplier(raw?.learningMultiplier, LEGACY_LEARNING_BONUS_CAP),
    reputationBonus: clampReputation(raw?.reputationBonus),
  };
}

/** Weekly income multiplier this life inherited. 1 when none. */
export function legacyIncomeMultiplier(state: Pick<GameState, 'legacyBonuses'> | null | undefined): number {
  return capLegacyBonuses(state?.legacyBonuses).incomeMultiplier;
}

/** Education speed multiplier this life inherited. 1 when none. */
export function legacyLearningMultiplier(state: Pick<GameState, 'legacyBonuses'> | null | undefined): number {
  return capLegacyBonuses(state?.legacyBonuses).learningMultiplier;
}

/** Opening reputation this life inherited. 0 when none. */
export function legacyReputationBonus(state: Pick<GameState, 'legacyBonuses'> | null | undefined): number {
  return capLegacyBonuses(state?.legacyBonuses).reputationBonus;
}
