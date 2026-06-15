/**
 * Premium Pack money-multiplier write→read chain (roadmap H7)
 *
 * The 2026-06-15 audit flagged a possible "paid upgrade does nothing" bug — and it
 * was REAL: the weekly income calc reads `goldUpgrades.multiplier` for the 1.5×,
 * but BOTH IAP entitlement-apply paths set only the dead `settings.moneyMultiplier`
 * flag for a money-multiplier product (goldUpgrades.multiplier was set only under
 * `allUpgrades`/`everythingUnlocked`, which the $24.99 Premium Pack does not have).
 * So buying the Premium Pack did nothing to income. Fixed in IAPService by also
 * setting `goldUpgrades.multiplier` under `config.moneyMultiplier`.
 *
 * These tests LOCK the full chain (IAP write → income read) so it can't regress.
 */

import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import { initialGameState } from '@/contexts/game/initialState';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import type { GameState } from '@/contexts/game/types';

function freshState(): GameState {
  return JSON.parse(JSON.stringify(initialGameState)) as GameState;
}

function incomeInput(state: GameState) {
  return {
    prevState: state,
    careerSalary: 1000,
    passiveIncome: 0,
    pulseEarnings: 0,
    weeksLivedNow: 100, // past the beginner-luck window (0-19) so income is deterministic
    unlockedBonuses: [] as string[],
  };
}

describe('Premium Pack money multiplier — write→read chain', () => {
  it('WRITE: applying the Premium Pack sets goldUpgrades.multiplier (the field income reads)', () => {
    const state = freshState();
    const applied = iapService.applyProductToState(state, IAP_PRODUCTS.GEMS_PREMIUM);

    expect(applied).toBe(true);
    // The money multiplier is delivered via goldUpgrades.multiplier — NOT the dead
    // settings.moneyMultiplier flag. computeWeeklyIncome reads goldUpgrades.multiplier.
    expect(state.goldUpgrades?.multiplier).toBe(true);
    // Same product also grants its gems (sanity that the apply actually ran).
    expect(state.stats.gems).toBeGreaterThanOrEqual(3500);
  });

  it('READ: computeWeeklyIncome applies a 1.5x bonus when goldUpgrades.multiplier is set', () => {
    const base = freshState();
    base.relationships = [];
    base.perks = undefined as unknown as GameState['perks'];

    const without = computeWeeklyIncome(
      incomeInput({ ...base, goldUpgrades: { ...base.goldUpgrades, multiplier: false } })
    );
    const withMult = computeWeeklyIncome(
      incomeInput({ ...base, goldUpgrades: { ...base.goldUpgrades, multiplier: true } })
    );

    expect(without.totalIncome).toBeGreaterThan(0);
    expect(withMult.totalIncome).toBeGreaterThan(without.totalIncome);
    // 1.5x within rounding tolerance (the prestige multiplier is identical in both).
    expect(withMult.totalIncome / without.totalIncome).toBeCloseTo(1.5, 2);
  });

  it('END-TO-END: buying the Premium Pack multiplies weekly income by 1.5x', () => {
    const plain = freshState();
    plain.relationships = [];
    plain.perks = undefined as unknown as GameState['perks'];
    const baseline = computeWeeklyIncome(incomeInput(plain));

    const premium = freshState();
    iapService.applyProductToState(premium, IAP_PRODUCTS.GEMS_PREMIUM);
    premium.relationships = [];
    premium.perks = undefined as unknown as GameState['perks'];
    const boosted = computeWeeklyIncome(incomeInput(premium));

    expect(boosted.totalIncome / baseline.totalIncome).toBeCloseTo(1.5, 2);
  });
});
