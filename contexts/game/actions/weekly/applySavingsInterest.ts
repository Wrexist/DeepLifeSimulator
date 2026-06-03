/**
 * Weekly savings interest — R7 Phase 2 step 2.4d.
 *
 * Scope: pure computation of the player's savings-account interest for
 * the tick. Previously inline in `GameActionsContext.tsx:877-908`.
 *
 * Three concerns folded in:
 *   1. APR selection: high-yield (financialPlanning setting OR credit
 *      score >= 740) vs base.
 *   2. Soft-cap diminishing returns: balance below `SAVINGS_BALANCE_SOFT_CAP`
 *      earns full rate; balance above earns at `SAVINGS_CAP_EFFICIENCY`.
 *   3. Good Credit perk stack: `goldUpgrades.good_credit` and
 *      `perks.goodCredit` each multiply interest by 1.5×, stack
 *      multiplicatively. Both were previously dead flags (the IAP set
 *      them but no callsite consumed them) until that bug was fixed.
 *
 * Pure function. No React, no setGameState, no side effects. Returns
 * `{ savingsInterest, newBankSavings }`. Caller uses `savingsInterest`
 * in the day-summary log line and `newBankSavings` writes into the new
 * GameState slice.
 */

import {
  SAVINGS_APR_BASE,
  SAVINGS_APR_FINANCIAL_PLANNING,
  SAVINGS_BALANCE_SOFT_CAP,
  SAVINGS_CAP_EFFICIENCY,
} from '@/lib/economy/constants';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface SavingsInterestInput {
  /** `prevState.bankSavings` — may be undefined / negative / NaN; guarded. */
  prevBankSavings: number | undefined;
  /** `prevState.banking?.creditScore?.score ?? 0`. */
  creditScore: number;
  /** `prevState.settings?.financialPlanning === true`. */
  financialPlanning: boolean;
  /** `prevState.goldUpgrades?.good_credit` truthy. */
  goldCreditUpgrade: boolean;
  /** `prevState.perks?.goodCredit` truthy. */
  goodCreditPerk: boolean;
}

export interface SavingsInterestResult {
  /** Interest earned this tick (may be 0 if no savings). */
  savingsInterest: number;
  /** New post-interest savings balance (floored at 0). */
  newBankSavings: number;
}

export function computeSavingsInterest(input: SavingsInterestInput): SavingsInterestResult {
  // 1. APR selection.
  // The higher APR was originally IAP-gated. Post-banking-remake (STATE_VERSION 14),
  // it's also unlocked by a "veryGood" credit score (740+), so the perk is now
  // earnable through gameplay. Existing IAP purchases still apply — the OR
  // makes the gate strictly looser, never stricter.
  const hasHighYieldUnlock = input.financialPlanning || input.creditScore >= 740;
  const savingsAPR = hasHighYieldUnlock ? SAVINGS_APR_FINANCIAL_PLANNING : SAVINGS_APR_BASE;

  // 2. Sanitize current savings (negative or NaN → 0).
  const currentSavings = typeof input.prevBankSavings === 'number' && isFinite(input.prevBankSavings)
    ? Math.max(0, input.prevBankSavings)
    : 0;

  // 3. Soft-cap diminishing-returns interest.
  // ANTI-EXPLOIT: balance below cap earns full rate, balance above earns reduced rate.
  let savingsInterest = 0;
  if (currentSavings > 0) {
    const belowCap = Math.min(currentSavings, SAVINGS_BALANCE_SOFT_CAP);
    const aboveCap = Math.max(0, currentSavings - SAVINGS_BALANCE_SOFT_CAP);
    savingsInterest = (belowCap * savingsAPR) / WEEKS_PER_YEAR
      + (aboveCap * savingsAPR * SAVINGS_CAP_EFFICIENCY) / WEEKS_PER_YEAR;

    // 4. Good Credit perk stack — both flags multiply by 1.5×, multiplicatively.
    let interestMultiplier = 1;
    if (input.goldCreditUpgrade) interestMultiplier *= 1.5;
    if (input.goodCreditPerk) interestMultiplier *= 1.5;
    savingsInterest *= interestMultiplier;
  }

  const newBankSavings = Math.max(0, currentSavings + savingsInterest);
  return { savingsInterest, newBankSavings };
}
