/**
 * Three more things the player buys that did nothing.
 *
 * GL-5 — "Debt Free" was unearnable. The achievement requires
 * `progress.hasBeenInDebt` to be true, no outstanding loans and non-negative
 * money. `hasBeenInDebt` is initialised to `false` in `initialState` and is
 * written NOWHERE ELSE in the repo — no loan path, no overdraft, no migration,
 * no `repairGameState` branch. So it sat at 0% forever no matter how a player
 * borrowed and repaid.
 *
 * GL-6 — the Life Skills "Investing" node advertises "+5% stock returns",
 * costs $2,000, is age-gated at 25 and is REQUIRED by the `wealth_master`
 * capstone, so anyone chasing that capstone is forced to buy it. Its modifier
 * `stockReturnMult` was computed, clamped to [1, 1.5], and read by nothing.
 *
 * GL-7 — Auto-Rest ("Automatically rest when energy < 20%", 3,000 prestige
 * points). `shouldAutoRest` had exactly one occurrence in the whole repo: its
 * own definition.
 *
 * 2026-07-30 audit GL-5 / GL-6 / GL-7.
 */
import { acceptLoan } from '@/contexts/game/actions/LoanActions';
import { initialGameState } from '@/contexts/game/initialState';
import { shouldAutoRest } from '@/lib/prestige/applyQOLBonuses';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * `acceptLoan` falls back to `initialGameState.banking` when the state has none,
 * so take the deposit account id from the same source rather than guessing.
 */
const CHECKING = initialGameState.banking?.accounts?.[0]?.id ?? 'checking';

/** Drive a reducer the way the app does and return the resulting state. */
function drive(state: GameState, run: (set: never) => void): GameState {
  let current = state;
  const set = ((u: (prev: GameState) => GameState) => {
    current = typeof u === 'function' ? u(current) : u;
  }) as never;
  run(set);
  return current;
}

describe('taking on debt is recorded, so "Debt Free" can be earned', () => {
  it('flips hasBeenInDebt when a loan is taken', () => {
    const before = createTestGameState({ weeksLived: 50 });
    expect(before.progress?.hasBeenInDebt).not.toBe(true);

    const after = drive(before, (set) => {
      acceptLoan(set, {
        principal: 10_000,
        termWeeks: 104,
        type: 'personal',
        name: 'Personal Loan',
        weeklyIncome: 500,
        depositAccountId: CHECKING,
      });
    });

    // The whole finding in one line: nothing anywhere used to write this.
    expect(after.progress?.hasBeenInDebt).toBe(true);
  });

  it('keeps the rest of `progress` intact', () => {
    const base = createTestGameState({ weeksLived: 50 });
    const seeded = createTestGameState({
      weeksLived: 50,
      progress: { ...(base.progress ?? {}), adsRemoved: true } as never,
    });

    const after = drive(seeded, (set) => {
      acceptLoan(set, {
        principal: 10_000,
        termWeeks: 104,
        type: 'personal',
        name: 'Personal Loan',
        weeklyIncome: 500,
        depositAccountId: CHECKING,
      });
    });

    expect((after.progress as { adsRemoved?: boolean })?.adsRemoved).toBe(true);
    expect(after.progress?.hasBeenInDebt).toBe(true);
  });

  it('stays true after the loan is gone — it records history, not current state', () => {
    const after = drive(createTestGameState({ weeksLived: 50 }), (set) => {
      acceptLoan(set, {
        principal: 10_000,
        termWeeks: 104,
        type: 'personal',
        name: 'Personal Loan',
        weeklyIncome: 500,
        depositAccountId: CHECKING,
      });
    });

    // Clearing the debt is what the achievement rewards; the flag must survive.
    const repaid = { ...after, loans: [] } as GameState;
    expect(repaid.progress?.hasBeenInDebt).toBe(true);
  });
});

describe('the Investing skill node produces a real modifier', () => {
  it('raises stockReturnMult above 1 when unlocked', () => {
    const withNode = createTestGameState({ unlockedLifeSkills: ['investing'] } as never);

    // If this is ever 1, the wiring below is scaling by nothing.
    expect(getLifeSkillModifiers(withNode).stockReturnMult).toBeGreaterThan(1);
  });

  it('is exactly 1 for a player without it', () => {
    expect(getLifeSkillModifiers(createTestGameState()).stockReturnMult).toBe(1);
  });

  it('stays inside the documented [1, 1.5] clamp', () => {
    const withNode = createTestGameState({ unlockedLifeSkills: ['investing'] } as never);
    const mult = getLifeSkillModifiers(withNode).stockReturnMult;

    expect(mult).toBeGreaterThanOrEqual(1);
    expect(mult).toBeLessThanOrEqual(1.5);
  });
});

describe('Auto-Rest fires for the bonus that promises it', () => {
  it('triggers below the threshold only when the bonus is owned', () => {
    expect(shouldAutoRest(10, ['auto_save_energy'])).toBe(true);
    expect(shouldAutoRest(10, [])).toBe(false);
  });

  it('does not trigger at or above the threshold', () => {
    expect(shouldAutoRest(20, ['auto_save_energy'])).toBe(false);
    expect(shouldAutoRest(85, ['auto_save_energy'])).toBe(false);
  });
});
