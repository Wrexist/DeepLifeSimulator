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
import fs from 'fs';
import path from 'path';
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
    const repaid = { ...after, loans: [] };
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

  /**
   * The predicate assertions above are NOT enough on their own.
   *
   * The first version of the tick wiring called `shouldAutoRest` AFTER the
   * week's energy regen, and `baseEnergyRegen` is 40 — so post-regen energy is
   * always at least 40 and the `< 20` test could never be true. The bonus was
   * still completely inert while these predicate tests passed. This models the
   * ordering the tick actually uses.
   */
  /**
   * Read BOTH numbers out of the tick rather than mirroring them by hand.
   *
   * A hand-mirrored `AUTO_REST_TARGET = 40` is what hid the SECOND inert
   * version of this bonus: the target equalled `baseEnergyRegen`, so the
   * `Math.max` top-up could never raise anything, and the assertion below —
   * then written as `toBeGreaterThanOrEqual(AUTO_REST_TARGET)` — passed on the
   * 45 that plain regen produces. Reading the source means the test moves when
   * the tick moves, and the comparison below is against the no-bonus baseline
   * rather than against a constant.
   */
  function constantFromTick(name: string): number {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'),
      'utf8',
    );
    const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
    if (!match) throw new Error(`${name} not found in GameActionsContext`);
    return Number(match[1]);
  }

  const AUTO_REST_TARGET = constantFromTick('AUTO_REST_TARGET_ENERGY');
  const BASE_REGEN = constantFromTick('baseEnergyRegen');

  function energyAfterTick(startEnergy: number, bonuses: string[]): number {
    // Mirrors the tick: decide from PRE-regen energy, then apply regen, then
    // top up. Never reduces.
    const wasExhausted = shouldAutoRest(startEnergy, bonuses);
    let energy = startEnergy + BASE_REGEN;
    if (wasExhausted) energy = Math.max(energy, AUTO_REST_TARGET);
    return energy;
  }

  it('has a target that plain regen cannot already reach', () => {
    // The structural reason the bonus was inert. Without this, every
    // behavioural assertion below can be satisfied by regen alone.
    expect(AUTO_REST_TARGET).toBeGreaterThan(BASE_REGEN);
  });

  it('fires for a player who ended the week exhausted', () => {
    // The decision must be made on the energy they ENDED on, not post-regen.
    expect(shouldAutoRest(5, ['auto_save_energy'])).toBe(true);

    // Against the NO-BONUS baseline, not against a constant. This is the
    // assertion that actually distinguishes a working bonus from an inert one.
    expect(energyAfterTick(5, ['auto_save_energy'])).toBeGreaterThan(energyAfterTick(5, []));
  });

  it('still helps a player right at the < 20 threshold', () => {
    // 19 is the worst case the bonus is meant to cover — regen alone takes it
    // to 59, so a target of 40 or 50 would leave the edge of the band inert
    // even if the floor case passed.
    expect(energyAfterTick(19, ['auto_save_energy'])).toBeGreaterThan(energyAfterTick(19, []));
  });

  it('would NEVER fire if the check ran after regen — the bug this replaced', () => {
    // Post-regen energy for an exhausted player, which the old wiring tested.
    const postRegen = 5 + BASE_REGEN;
    expect(shouldAutoRest(postRegen, ['auto_save_energy'])).toBe(false);
  });

  it('never reduces the energy of a rested player who owns it', () => {
    const rested = energyAfterTick(90, ['auto_save_energy']);
    expect(rested).toBeGreaterThanOrEqual(90);
  });

  it('changes nothing for a player without the bonus', () => {
    expect(energyAfterTick(5, [])).toBe(5 + BASE_REGEN);
  });
});
