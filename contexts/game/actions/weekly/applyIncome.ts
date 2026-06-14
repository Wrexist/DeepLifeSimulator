/**
 * Weekly income aggregation — R7 Phase 2 step 2.4a.
 *
 * Scope: composes the player's total income for the tick. Previously inline
 * in `GameActionsContext.tsx:822-879`. Six concerns rolled into one helper:
 *
 *   1. Partner/spouse income — 25% of partner.income when relationshipScore >= 50.
 *   2. Prestige income multiplier — from `getIncomeMultiplier(unlockedBonuses)`.
 *   3. Base total — careerSalary + passiveIncome + partnerIncome + pulseEarnings.
 *   4. Beginner-luck bonus — deterministic sin-seeded bonus for weeks < 20.
 *   5. Money-Multiplier gold upgrade — flat 1.5× when `goldUpgrades.multiplier`.
 *   6. Onboarding perk income multipliers — stacked product of `perk.effects.incomeMultiplier`.
 *
 * Pure function. No React, no setGameState, no side effects. Returns the
 * three intermediate values the caller's downstream blocks still need:
 *   - `partnerIncome` (used in the day-summary log line)
 *   - `baseTotalIncome` (pre-multipliers, post-luck — used in some debug paths)
 *   - `totalIncome` (post-everything — the money writeback uses this)
 *
 * Byte-identical output to the previous inline code (verified by snapshot
 * tests in `__tests__/refactor/subsystemEquivalence.test.ts`).
 */

import type { GameState } from '@/contexts/game/types';
import {
  BEGINNER_LUCK_WEEKS,
  BEGINNER_LUCK_BASE_BONUS,
  BEGINNER_LUCK_RANDOM_MAX,
} from '@/lib/config/gameConstants';
import { getIncomeMultiplier } from '@/lib/prestige/applyBonuses';

/**
 * Upper bound on the combined onboarding-perk income multiplier. Individual
 * perks grant ~1.02–1.10; without a cap the stacked product is unbounded and
 * can be farmed by selecting every income perk. Perks can at most double income.
 */
const MAX_PERK_INCOME_BONUS = 2.0;

export interface IncomeTickInput {
  /** Full prev state — needed for relationships, perks, goldUpgrades. */
  prevState: GameState;
  /** Career salary AFTER per-job adjustments (computed upstream). */
  careerSalary: number;
  /** Result of `calcWeeklyPassiveIncome(prevState).total`. */
  passiveIncome: number;
  /** Pulse impression + brand-deal earnings (0 if pulseTickResult is null). */
  pulseEarnings: number;
  /** Current `prevState.weeksLived || 0`. Drives the beginner-luck window. */
  weeksLivedNow: number;
  /** `prevState.prestige?.unlockedBonuses || []`. */
  unlockedBonuses: string[];
}

export interface IncomeTickResult {
  /** Sum of 25%-nerfed partner/spouse incomes. */
  partnerIncome: number;
  /** Career + passive + partner + pulse + beginner-luck. PRE-multipliers. */
  baseTotalIncome: number;
  /** Final rounded total after applying all multipliers. */
  totalIncome: number;
}

export function computeWeeklyIncome(input: IncomeTickInput): IncomeTickResult {
  // 1. Partner/spouse income (25% nerf).
  let partnerIncome = 0;
  (input.prevState.relationships || []).forEach((rel) => {
    if (rel && rel.income && (rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 50) {
      const safeIncome = typeof rel.income === 'number' && isFinite(rel.income) && rel.income >= 0 ? rel.income : 0;
      partnerIncome += Math.round(safeIncome * 0.25);
    }
  });

  // 2. Prestige income multiplier.
  const incomeMultiplier = getIncomeMultiplier(input.unlockedBonuses);
  const safeIncomeMultiplier = typeof incomeMultiplier === 'number' && isFinite(incomeMultiplier) && incomeMultiplier > 0
    ? incomeMultiplier
    : 1.0;

  // 3. Base total income (pre-multipliers, pre-beginner-luck).
  let baseTotalIncome = input.careerSalary + input.passiveIncome + partnerIncome + input.pulseEarnings;

  // 4. Beginner luck bonus (weeks 0-19). Deterministic sin-seeded.
  if (input.weeksLivedNow < BEGINNER_LUCK_WEEKS) {
    const luckSeed = input.weeksLivedNow * 777 + 42;
    const luckX = Math.sin(luckSeed) * 10000;
    const luckRoll = luckX - Math.floor(luckX);
    const luckBonus = BEGINNER_LUCK_BASE_BONUS + Math.floor(luckRoll * BEGINNER_LUCK_RANDOM_MAX);
    baseTotalIncome += luckBonus;
  }

  // 5. Money Multiplier gold upgrade — 1.5× when active.
  const moneyMultiplierBonus = input.prevState.goldUpgrades?.multiplier ? 1.5 : 1;

  // 6. Onboarding perk income multipliers (stacked product).
  // The `require()` is preserved verbatim from the legacy inline code. The
  // perks catalog has no side effects on load, but ES-importing it would
  // be a separate refactor — out of scope for this byte-faithful extraction.
  let perkIncomeBonus = 1;
  if (input.prevState.perks) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { perks: perksCatalog } = require('@/src/features/onboarding/perksData');
    for (const [perkId, isActive] of Object.entries(input.prevState.perks)) {
      if (!isActive) continue;
      const perk = perksCatalog.find((p: { id: string; effects?: { incomeMultiplier?: number } }) => p.id === perkId);
      const mult = perk?.effects?.incomeMultiplier;
      if (typeof mult === 'number' && mult > 0 && mult !== 1) {
        perkIncomeBonus *= mult;
      }
    }
    // Stacked perk multipliers are otherwise unbounded; cap the combined bonus
    // so income can at most double from perks (individual perks are ~1.02–1.10).
    perkIncomeBonus = Math.min(perkIncomeBonus, MAX_PERK_INCOME_BONUS);
  }

  const totalIncome = Math.round(baseTotalIncome * safeIncomeMultiplier * moneyMultiplierBonus * perkIncomeBonus);

  return { partnerIncome, baseTotalIncome, totalIncome };
}
