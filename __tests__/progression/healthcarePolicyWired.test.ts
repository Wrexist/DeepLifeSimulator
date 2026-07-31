/**
 * The healthcare half of enacted policy has to actually do something.
 *
 * `calculateActivePolicyEffects` aggregates seven policy categories into
 * `politics.activePolicyEffects`. Six had a consumer; `healthcare` had none.
 * Its only reader in the whole repo was `PoliticalApp.tsx:249-250`, which
 * RENDERS the numbers — "Health / week +5", "Medical costs −25%" — so the game
 * displayed an effect it never applied. Three policies carry it, worth +12
 * health a week and 50% off medicine between them. 2026-07-30 audit GL-3.
 *
 * These pin the two halves separately, because they are wired in different
 * places (the week tick and the health-activity charge) and either could
 * regress alone.
 */
import {
  healthcarePolicyPerks,
  policyAdjustedActivityPrice,
  POLICY_DISCOUNTED_ACTIVITY_IDS,
} from '@/lib/politics/healthcarePerks';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function withHealthcarePolicy(
  healthcare: { healthBonus?: number; medicalCostReduction?: number } | undefined,
): GameState {
  const base = createTestGameState();
  return {
    ...base,
    politics: {
      ...(base.politics ?? {}),
      activePolicyEffects: healthcare ? { healthcare } : undefined,
    },
  } as GameState;
}

describe('the healthcare effects are readable at all', () => {
  it('reads both fields off enacted policy', () => {
    const perks = healthcarePolicyPerks(
      withHealthcarePolicy({ healthBonus: 12, medicalCostReduction: 40 }),
    );

    expect(perks.weeklyHealthBonus).toBe(12);
    expect(perks.medicalCostReductionPct).toBe(40);
  });

  it('is all zeroes for a player who has enacted nothing', () => {
    const perks = healthcarePolicyPerks(withHealthcarePolicy(undefined));

    expect(perks.weeklyHealthBonus).toBe(0);
    expect(perks.medicalCostReductionPct).toBe(0);
  });

  it('bounds a corrupt save rather than granting infinite health or free care', () => {
    // `Number(Infinity) || 0` is Infinity — the trap this guards.
    for (const bad of [Infinity, NaN, -50, 1e12, 'lots' as unknown as number]) {
      const perks = healthcarePolicyPerks(
        withHealthcarePolicy({ healthBonus: bad, medicalCostReduction: bad }),
      );

      expect(Number.isFinite(perks.weeklyHealthBonus)).toBe(true);
      expect(perks.weeklyHealthBonus).toBeGreaterThanOrEqual(0);
      expect(perks.medicalCostReductionPct).toBeLessThanOrEqual(50);
      expect(perks.medicalCostReductionPct).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the discount reaches the price the player is charged', () => {
  it('takes 25% off a hospital stay', () => {
    const state = withHealthcarePolicy({ medicalCostReduction: 25 });

    expect(policyAdjustedActivityPrice(state, 'hospital', 2000)).toBe(1500);
  });

  it('charges the list price when no policy is enacted', () => {
    // The control. Without it, a function that returned the input unchanged
    // would satisfy nothing above but still look plausible here.
    const state = withHealthcarePolicy(undefined);

    expect(policyAdjustedActivityPrice(state, 'hospital', 2000)).toBe(2000);
  });

  it('discounts every medical activity and no wellness one', () => {
    const state = withHealthcarePolicy({ medicalCostReduction: 50 });

    for (const id of POLICY_DISCOUNTED_ACTIVITY_IDS) {
      expect(policyAdjustedActivityPrice(state, id, 1000)).toBe(500);
    }
    // Subsidised healthcare should not pay for the player's massage.
    for (const id of ['massage', 'yoga', 'walk', 'spa']) {
      expect(policyAdjustedActivityPrice(state, id, 1000)).toBe(1000);
    }
  });

  it('rounds down, so the discount is never worse than advertised', () => {
    const state = withHealthcarePolicy({ medicalCostReduction: 15 });

    // 999 * 0.85 = 849.15
    expect(policyAdjustedActivityPrice(state, 'doctor', 999)).toBe(849);
  });

  it('never returns a negative or non-finite price', () => {
    const state = withHealthcarePolicy({ medicalCostReduction: 50 });

    for (const price of [0, -100, NaN, Infinity]) {
      const out = policyAdjustedActivityPrice(state, 'doctor', price);
      expect(Number.isFinite(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the wiring is present at both call sites', () => {
  // Static, because both sites sit inside code that needs the full provider
  // tree to run. What regressed is that NOTHING read these fields; what a
  // future edit would remove is the read.
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string): string =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the week tick adds the weekly health bonus', () => {
    const tick = read('contexts/game/GameActionsContext.tsx');

    expect(tick).toMatch(/healthcarePolicyPerks\(prevState\)/);
    expect(tick).toMatch(/weeklyHealthBonus/);
  });

  it('the health-activity charge uses the adjusted price for BOTH the gate and the debit', () => {
    const items = read('contexts/game/ItemActionsContext.tsx');

    // The gate-then-grant trap in price form: checking the list price and
    // debiting the discounted one (or the reverse) is the failure mode.
    expect(items).toMatch(/const chargedPrice = policyAdjustedActivityPrice\(prevState,/);
    expect(items).toMatch(/prevState\.stats\.money < chargedPrice/);
    expect(items).toMatch(/currentMoney - chargedPrice/);
    expect(items).not.toMatch(/currentMoney - activity\.price/);
  });

  it('the screens quote the same price they will be charged', () => {
    for (const rel of ['app/(tabs)/health.tsx', 'components/SicknessModal.tsx']) {
      expect(read(rel)).toMatch(/policyAdjustedActivityPrice/);
    }
    // The modal used to hardcode the two treatment prices.
    expect(read('components/SicknessModal.tsx')).not.toMatch(/playerMoney < 500\b/);
    expect(read('components/SicknessModal.tsx')).not.toMatch(/playerMoney < 2000\b/);
  });
});
